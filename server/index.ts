import { createDeskThing } from '@deskthing/server';
import { DESKTHING_EVENTS, SETTING_TYPES, type AppSettings } from '@deskthing/types';
import type { LimitedUser, World, Instance } from 'vrchat';
import type { CombinedUser } from '../src/types/types';
import { downloadVRCImage } from './utils';
import { loadProfile } from './profile';
import { profileImages, type ProfileDetails } from '../src/types/profile';
import { VRCSession, LoginRequired, safeError, type SavedSession } from './session';

type ClientRequest = { type: 'vrc_request'; request: string; payload?: { world?: string; instanceid?: string; userId?: string } };
const DK = createDeskThing<ClientRequest, { type: string; payload: string }>();
let settings: AppSettings = {};
let initialized: Promise<void> | undefined;
let settingsLoaded = false;
let refresh: Promise<void> | undefined;
let latestFriends: { account: string; username: string; users: CombinedUser[] } | undefined;
let stopped = false;
const value = (key: string) => String(settings[key]?.value ?? '');
const status = (message: string, error = false) => {
  if (!stopped) DK.send({ type: error ? 'vrc_error' : 'vrc_status', payload: message });
};

const session = new VRCSession({
  credentials: () => ({ username: value('email'), password: value('password'), code: value('twoFactorCode') }),
  load: async () => {
    const data = await DK.getData();
    if (!data) throw new LoginRequired('DeskThing could not load saved session data. Try again once the desktop app is ready.');
    return data?.vrchatSession as SavedSession | undefined;
  },
  save: async (vrchatSession) => { await DK.saveData({ vrchatSession }); },
  consumeCode: async () => {
    if (settings.twoFactorCode?.type === SETTING_TYPES.STRING) {
      settings = { ...settings, twoFactorCode: { ...settings.twoFactorCode, value: '' } };
      await DK.saveSettings(settings);
    }
  },
});

async function initialize() {
  const stored = await DK.getSettings();
  if (!stored) throw new LoginRequired('DeskThing could not load settings. Restart the app once the desktop app is ready.');
  const field = (id: string, label: string, description: string) => ({
    id, label, description, type: SETTING_TYPES.STRING as const,
    value: id === 'twoFactorCode' ? '' : String(stored?.[id]?.value ?? ''),
  });
  // setSettings is awaited; this SDK's initSettings starts an unawaited settings write.
  await DK.setSettings({
    email: field('email', 'VRChat Username', 'Your VRChat account username (not your display name).'),
    password: field('password', 'VRChat Password', 'Stored locally by DeskThing. Used only when the saved session is no longer valid.'),
    twoFactorCode: field('twoFactorCode', '2FA Code', 'When the display asks, enter a fresh authenticator or email code and save. Cleared after submission.'),
  });
  settings = (await DK.getSettings()) ?? stored ?? {};
  // The replacement jar is private app data, not a user-editable setting.
  await DK.deleteSettings(['cookieJar', 'cookiejar', 'two_factor_code']);
  settingsLoaded = true;
}

function ready() {
  return initialized ??= initialize().catch(error => { initialized = undefined; throw error; });
}

const worldCache = new Map<string, Promise<World>>();
const instanceCache = new Map<string, Promise<Instance>>();
const profileCache = new Map<string, { expires: number; result: Promise<ProfileDetails> }>();
async function sendProfile(id: string) {
  const account = value('email').trim().toLowerCase();
  const key = `${account}:${id}`;
  let cached = profileCache.get(key);
  if (!cached || cached.expires < Date.now()) {
    cached = { expires: Date.now() + 5 * 60_000, result: loadProfile(id, session.client, operation => session.read(operation)) };
    profileCache.set(key, cached);
    void cached.result.catch(() => { profileCache.delete(key); });
  }
  try {
    const profile = await cached.result;
    if (!profile.imageUrl) cached.expires = 0; // A retry should try the failed download again.
    if (!stopped && account === value('email').trim().toLowerCase()) {
      DK.send({ type: 'vrc_profile', payload: JSON.stringify(profile) });
    }
  } catch (error) {
    if (!stopped && account === value('email').trim().toLowerCase()) {
      DK.send({ type: 'vrc_profile_error', payload: JSON.stringify({ id, message: safeError(error) }) });
    }
  }
}
function getWorld(id: string) {
  if (!worldCache.has(id)) {
    const request = session.read(async () => (await session.client.get<World>(`/worlds/${encodeURIComponent(id)}`)).data)
      .then(async world => {
        world.imageUrl = await downloadVRCImage(world.imageUrl, session.client, id) ?? world.imageUrl;
        return world;
      });
    worldCache.set(id, request);
    void request.catch(() => { worldCache.delete(id); });
  }
  return worldCache.get(id)!;
}

function getInstance(world: string, instance: string) {
  const key = `${world}:${instance}`;
  if (!instanceCache.has(key)) {
    const request = session.read(async () => (await session.client.get<Instance>(`/instances/${encodeURIComponent(world)}:${encodeURIComponent(instance)}`)).data);
    instanceCache.set(key, request);
    void request.catch(() => { instanceCache.delete(key); });
  }
  return instanceCache.get(key)!;
}

async function refreshFriends() {
  await ready();
  const account = value('email').trim().toLowerCase();
  status('Connecting to VRChat...');
  const user = await session.ensure();
  DK.send({ type: 'logged_in_username', payload: user.displayName });
  status('Loading friends...');
  const users = await session.read(async () => (await session.client.get<LimitedUser[]>('/auth/user/friends', { params: { offset: 0, n: 50, offline: false } })).data);
  const combined: CombinedUser[] = users.map(friend => ({ user: friend }));
  if (account !== value('email').trim().toLowerCase() || stopped) return;
  latestFriends = { account, username: user.displayName, users: combined };
  // Deliver useful data before optional images/world lookups.
  DK.send({ type: 'vrc_friendslist', payload: JSON.stringify(combined) });
  worldCache.clear();
  instanceCache.clear();
  let next = 0;
  // Limit the whole workload rather than launching 50 downloads at once.
  await Promise.all(Array.from({ length: Math.min(3, combined.length) }, async () => {
    while (next < combined.length && !stopped && account === value('email').trim().toLowerCase()) {
      const friend = combined[next++];
      for (const image of profileImages(friend.user)) {
        friend.imageUrl = await downloadVRCImage(image, session.client, friend.user.id);
        if (friend.imageUrl) break;
      }
      const location = friend.user.location;
      if (location?.startsWith('wrld_') && location.includes(':')) {
        const separator = location.indexOf(':');
        const worldId = location.slice(0, separator);
        const instanceId = location.slice(separator + 1);
        const [world, instance] = await Promise.allSettled([getWorld(worldId), getInstance(worldId, instanceId)]);
        if (world.status === 'fulfilled') friend.world = world.value;
        if (instance.status === 'fulfilled') friend.instance = instance.value;
      }
    }
  }));
  if (!stopped && account === value('email').trim().toLowerCase()) {
    DK.send({ type: 'vrc_friendslist', payload: JSON.stringify(combined) });
    status(users.length ? '' : 'No friends are online right now.');
  }
}

function requestFriends() {
  if (refresh && latestFriends?.account === value('email').trim().toLowerCase()) {
    // A client can reconnect while optional enrichment is still running.
    DK.send({ type: 'logged_in_username', payload: latestFriends.username });
    DK.send({ type: 'vrc_friendslist', payload: JSON.stringify(latestFriends.users) });
  }
  return refresh ??= refreshFriends().catch(error => {
    const message = safeError(error);
    status(message, true);
    console.warn(`[VRCHAT] ${message}`); // No request objects, cookies, or credentials.
  }).finally(() => { refresh = undefined; });
}

DK.on(DESKTHING_EVENTS.START, async () => {
  stopped = false;
  try { await ready(); }
  catch { status('Could not load DeskThing settings. Restart the app.', true); }
});
DK.on(DESKTHING_EVENTS.STOP, () => { stopped = true; });
DK.on(DESKTHING_EVENTS.SETTINGS, async event => {
  const previousAccount = value('email').trim().toLowerCase();
  const before = JSON.stringify([value('email'), value('password'), value('twoFactorCode')]);
  settings = event.payload;
  if (settingsLoaded && previousAccount !== value('email').trim().toLowerCase()) {
    latestFriends = undefined;
    profileCache.clear();
    DK.send({ type: 'vrc_friendslist', payload: '[]' });
    DK.send({ type: 'logged_in_username', payload: 'user' });
  }
  const after = JSON.stringify([value('email'), value('password'), value('twoFactorCode')]);
  if (settingsLoaded && before !== after && (value('twoFactorCode') || value('email') && value('password'))) {
    await refresh;
    if (!stopped) await requestFriends();
  }
});
DK.on('vrc_request', async data => {
  try {
    await ready();
    switch (data.request) {
      case 'vrc_friendslist': await requestFriends(); break;
      case 'profile': {
        const id = data.payload?.userId;
        if (id && /^usr_[a-zA-Z0-9_-]+$/.test(id)) await sendProfile(id);
        break;
      }
      case 'logged_in_username': break; // Sent by refreshFriends after authentication.
      case 'world': {
        const id = String(data.payload?.world ?? '').split(':')[0];
        if (id.startsWith('wrld_')) DK.send({ type: 'world', payload: JSON.stringify(await getWorld(id)) });
        break;
      }
      case 'instance': {
        const location = String(data.payload?.instanceid ?? '');
        const separator = location.indexOf(':');
        if (separator > 0) DK.send({ type: 'instance', payload: JSON.stringify(await getInstance(location.slice(0, separator), location.slice(separator + 1))) });
        break;
      }
    }
  } catch (error) { status(safeError(error), true); }
});
