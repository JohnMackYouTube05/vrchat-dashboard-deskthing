import axios, { type AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

export const API_URL = 'https://api.vrchat.cloud/api/1';
export const USER_AGENT = 'VRChatDashboard-DeskThing/0.12.1 (https://github.com/JohnMackYouTube05/vrchat-dashboard-deskthing)';

export type Credentials = { username: string; password: string; code: string };
export type SavedSession = { version: 1; account: string; jar: ReturnType<CookieJar['toJSON']> };
type CurrentUser = { id: string; displayName: string; requiresTwoFactorAuth?: string[] };
type SessionOptions = {
  credentials: () => Credentials;
  load: () => Promise<SavedSession | undefined>;
  save: (session: SavedSession) => Promise<void>;
  consumeCode: () => Promise<void>;
  // Allows real cookie transport to be tested against a local HTTP server.
  baseURL?: string;
};

export class LoginRequired extends Error {}

export function safeError(error: unknown): string {
  if (error instanceof LoginRequired) return error.message;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 429) return 'VRChat is rate limiting requests. Wait before trying again.';
    if (status === 401) return 'VRChat rejected the login or session. Check your credentials and try again.';
    if (status === 403) return 'VRChat denied this request. Check your account on the VRChat website.';
    if (status) return `VRChat request failed (HTTP ${status}). Try again later.`;
    return 'Could not reach VRChat. Check your connection and try again.';
  }
  return 'The request failed. Check the DeskThing app logs and try again.';
}

/** One cookie jar and one in-flight authentication attempt for the entire app. */
export class VRCSession {
  private jar = new CookieJar();
  private account = '';
  private loaded = false;
  private user?: CurrentUser;
  private login?: Promise<CurrentUser>;
  private retryAfter = 0;
  private blockedMessage = '';
  private lastCredentials = '';
  private lastCode = '';
  readonly client: AxiosInstance;

  constructor(private options: SessionOptions) {
    this.client = wrapper(axios.create({
      baseURL: options.baseURL ?? API_URL,
      jar: this.jar,
      withCredentials: true,
      timeout: 15_000,
      headers: { 'User-Agent': USER_AGENT },
    }));
  }

  ensure(): Promise<CurrentUser> {
    if (this.login) return this.login;
    this.login = this.authenticate().finally(() => { this.login = undefined; });
    return this.login;
  }

  private async persist() {
    await this.options.save({ version: 1, account: this.account, jar: this.jar.toJSON() });
  }

  private async authenticate(): Promise<CurrentUser> {
    const credentials = this.options.credentials();
    const account = credentials.username.trim().toLowerCase();
    if (!this.loaded) {
      const saved = await this.options.load();
      if (saved?.version === 1 && saved.account === account) {
        try { this.jar = CookieJar.deserializeSync(saved.jar); }
        catch { console.warn('[VRCHAT] Saved session is unreadable; a new login is required.'); }
      }
      this.account = account;
      this.client.defaults.jar = this.jar;
      this.loaded = true;
    }
    if (this.account !== account) {
      this.jar = new CookieJar();
      this.client.defaults.jar = this.jar;
      this.account = account;
      this.user = undefined;
      this.lastCode = '';
      this.retryAfter = 0;
      await this.persist();
    }
    const credentialKey = JSON.stringify([account, credentials.password]);
    if (credentialKey !== this.lastCredentials) {
      this.lastCredentials = credentialKey;
      this.retryAfter = 0;
    }
    if (this.user) return this.user;
    if (Date.now() < this.retryAfter) throw new LoginRequired(this.blockedMessage);

    try {
      let current: CurrentUser;
      try {
        // Never attach Basic authentication when validating/restoring cookies.
        current = (await this.client.get<CurrentUser>('/auth/user')).data;
      } catch (error) {
        if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
        if (!credentials.username.trim() || !credentials.password) {
          throw new LoginRequired('Enter your VRChat username and password in DeskThing settings.');
        }
        const basic = Buffer.from(`${encodeURIComponent(credentials.username.trim())}:${encodeURIComponent(credentials.password)}`).toString('base64');
        current = (await this.client.get<CurrentUser>('/auth/user', {
          headers: { Authorization: `Basic ${basic}` },
        })).data;
        this.lastCode = '';
      }
      // Persist the pending auth cookie BEFORE waiting for the human's 2FA code.
      await this.persist();
      const methods = current.requiresTwoFactorAuth;
      if (Array.isArray(methods) && methods.length) {
        const method = methods.includes('totp') ? 'totp' : methods.includes('emailOtp') ? 'emailotp' : undefined;
        if (!method) throw new LoginRequired('This account requires an unsupported verification method. Check VRChat on the web.');
        const prompt = `Enter a fresh ${method === 'totp' ? 'authenticator' : 'email'} 2FA code in DeskThing settings and save.`;
        const code = credentials.code.trim();
        if (!code || code === this.lastCode) throw new LoginRequired(prompt);
        // Consume before sending: a rejected/expired code must never be retried automatically.
        this.lastCode = code;
        await this.options.consumeCode();
        try {
          const result = await this.client.post<{ verified: boolean }>(`/auth/twofactorauth/${method}/verify`, { code });
          if (!result.data.verified) throw new LoginRequired(`VRChat rejected that code. ${prompt}`);
        } catch (error) {
          if (axios.isAxiosError(error) && [400, 401].includes(error.response?.status ?? 0)) {
            throw new LoginRequired(`VRChat rejected that code. ${prompt}`);
          }
          throw error;
        } finally {
          await this.persist();
        }
        current = (await this.client.get<CurrentUser>('/auth/user')).data;
      }
      if (!current.id || current.requiresTwoFactorAuth?.length) {
        throw new LoginRequired('VRChat has not completed login. Enter a fresh 2FA code in settings.');
      }
      await this.persist();
      this.user = current;
      return current;
    } catch (error) {
      // Network failures and throttling must never trigger a new credential login.
      if (!(error instanceof LoginRequired)) {
        this.blockedMessage = safeError(error);
        const retry = axios.isAxiosError(error) ? error.response?.headers['retry-after'] : undefined;
        const seconds = Number(retry);
        const delay = retry && !Number.isFinite(seconds) ? Date.parse(String(retry)) - Date.now() : seconds * 1000;
        this.retryAfter = Date.now() + Math.max(30_000, Number.isFinite(delay) ? delay : 0);
      }
      throw error;
    }
  }

  /** Only use for idempotent API reads. Retry a rejected session once. */
  async read<T>(operation: () => Promise<T>): Promise<T> {
    await this.ensure();
    try { return await operation(); }
    catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
      this.user = undefined;
      await this.ensure();
      return operation();
    }
  }
}
