import { strict as assert } from 'node:assert';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { VRCSession, type SavedSession, type Credentials } from './session';

type Handler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
const reply = (res: ServerResponse, status: number, data: unknown, cookies?: string[]) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...(cookies ? { 'Set-Cookie': cookies } : {}) });
  res.end(JSON.stringify(data));
};
const user = { id: 'usr_test', displayName: 'Test User' };
async function fixture(handler: Handler) {
  const server = createServer((req, res) => { void handler(req, res); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const baseURL = `http://127.0.0.1:${address.port}`;
  const credentials: Credentials = { username: 'test+name', password: 'p:a ss', code: '' };
  let saved: SavedSession | undefined;
  let consumed = 0;
  const makeSession = () => new VRCSession({
    baseURL, credentials: () => ({ ...credentials }), load: async () => saved,
    save: async value => { saved = JSON.parse(JSON.stringify(value)); },
    consumeCode: async () => { consumed++; credentials.code = ''; },
  });
  return {
    makeSession, credentials, baseURL,
    get saved() { return saved; },
    set saved(value) { saved = value; },
    get consumed() { return consumed; },
    close: async () => { server.closeAllConnections(); server.close(); await once(server, 'close'); },
  };
}

test('concurrent requests share one login; restart restores cookies without Basic auth', async () => {
  let basic = 0;
  let probes = 0;
  const f = await fixture((req, res) => {
    if (req.headers.authorization) {
      basic++;
      assert.equal(req.headers.authorization, `Basic ${Buffer.from('test%2Bname:p%3Aa%20ss').toString('base64')}`);
      reply(res, 200, user, ['auth=valid; Path=/']);
    } else {
      probes++;
      reply(res, req.headers.cookie?.includes('auth=valid') ? 200 : 401, user);
    }
  });
  try {
    const session = f.makeSession();
    const results = await Promise.all(Array.from({ length: 20 }, () => session.ensure()));
    assert(results.every(result => result.id === user.id));
    assert.equal(basic, 1);
    assert.equal(probes, 1);
    assert(f.saved);
    await f.makeSession().ensure();
    assert.equal(basic, 1);
    assert.equal(probes, 2);
    assert.equal(f.consumed, 0);
  } finally { await f.close(); }
});

for (const [method, endpoint] of [['totp', 'totp'], ['emailOtp', 'emailotp']]) {
  test(`${method}: pending login survives restart; verification sends the same auth cookie`, async () => {
    let basic = 0;
    let verified = 0;
    const f = await fixture(async (req, res) => {
      if (req.url === `/auth/twofactorauth/${endpoint}/verify`) {
        assert.equal(req.headers.authorization, undefined);
        assert(req.headers.cookie?.includes('auth=pending'));
        let body = '';
        for await (const chunk of req) body += chunk;
        assert.deepEqual(JSON.parse(body), { code: '123456' });
        verified++;
        reply(res, 200, { verified: true }, ['twoFactorAuth=valid; Path=/']);
      } else if (req.headers.authorization) {
        basic++;
        reply(res, 200, { requiresTwoFactorAuth: [method] }, ['auth=pending; Path=/']);
      } else if (req.headers.cookie?.includes('twoFactorAuth=valid')) {
        reply(res, 200, user);
      } else if (req.headers.cookie?.includes('auth=pending')) {
        reply(res, 200, { requiresTwoFactorAuth: [method] });
      } else reply(res, 401, {});
    });
    try {
      await assert.rejects(f.makeSession().ensure(), /fresh.*2FA code/);
      assert(f.saved);
      f.credentials.code = '123456';
      await f.makeSession().ensure();
      assert.equal(basic, 1);
      assert.equal(verified, 1);
      assert.equal(f.consumed, 1);
      assert.equal(f.credentials.code, '');
      await f.makeSession().ensure();
      assert.equal(basic, 1);
      assert.equal(verified, 1);
    } finally { await f.close(); }
  });
}

test('rejected 2FA consumes the code and waits without creating another session', async () => {
  let basic = 0;
  let attempts = 0;
  const f = await fixture((req, res) => {
    if (req.url?.includes('/verify')) {
      attempts++;
      reply(res, 400, { error: {} });
    } else if (req.headers.authorization) {
      basic++;
      reply(res, 200, { requiresTwoFactorAuth: ['totp'] }, ['auth=pending; Path=/']);
    } else if (req.headers.cookie) reply(res, 200, { requiresTwoFactorAuth: ['totp'] });
    else reply(res, 401, {});
  });
  try {
    f.credentials.code = 'expired';
    const session = f.makeSession();
    await assert.rejects(session.ensure(), /rejected that code/);
    await assert.rejects(session.ensure(), /fresh.*2FA code/);
    assert.equal(basic, 1);
    assert.equal(attempts, 1);
    f.credentials.code = 'new-code';
    await assert.rejects(session.ensure(), /rejected that code/);
    assert.equal(attempts, 2);
    assert.equal(basic, 1);
  } finally { await f.close(); }
});

test('a resource 401 revalidates the session and retries the read once', async () => {
  let basic = 0;
  let reads = 0;
  let revoked = false;
  const f = await fixture((req, res) => {
    if (req.url === '/friends') {
      reads++;
      reply(res, revoked ? 401 : 200, []);
    } else if (req.headers.authorization) {
      basic++;
      revoked = false;
      reply(res, 200, user, [`auth=session${basic}; Path=/`]);
    } else reply(res, !revoked && req.headers.cookie ? 200 : 401, user);
  });
  try {
    const session = f.makeSession();
    await session.ensure();
    revoked = true;
    await session.read(() => session.client.get('/friends'));
    assert.equal(basic, 2);
    assert.equal(reads, 2);
  } finally { await f.close(); }
});

for (const status of [403, 429, 503]) {
  test(`HTTP ${status} does not fall back to passwords or spin in a login loop`, async () => {
    let requests = 0;
    const f = await fixture((req, res) => {
      requests++;
      assert.equal(req.headers.authorization, undefined);
      res.setHeader('Retry-After', '60');
      reply(res, status, {});
    });
    try {
      const session = f.makeSession();
      await assert.rejects(session.ensure());
      await assert.rejects(session.ensure());
      assert.equal(requests, 1);
    } finally { await f.close(); }
  });
}

test('changing accounts discards the old account cookies', async () => {
  let basic = 0;
  const f = await fixture((req, res) => {
    if (req.headers.authorization) {
      basic++;
      reply(res, 200, user, ['auth=valid; Path=/']);
    } else reply(res, req.headers.cookie ? 200 : 401, user);
  });
  try {
    const session = f.makeSession();
    await session.ensure();
    f.credentials.username = 'different-user';
    await session.ensure();
    assert.equal(basic, 2);
    assert.equal(f.saved?.account, 'different-user');
  } finally { await f.close(); }
});

test('a corrupt cookie jar falls back to a clean login', async () => {
  const f = await fixture((req, res) => reply(res, req.headers.authorization ? 200 : 401, user));
  try {
    f.saved = { version: 1, account: f.credentials.username, jar: { cookies: 'broken' } as unknown as SavedSession['jar'] };
    assert.equal((await f.makeSession().ensure()).id, user.id);
  } finally { await f.close(); }
});

test('unavailable DeskThing storage must not be treated as a missing session', async () => {
  let requests = 0;
  const f = await fixture((_req, res) => { requests++; reply(res, 200, user); });
  try {
    const session = new VRCSession({
      baseURL: f.baseURL,
      credentials: () => f.credentials,
      load: async () => { throw new Error('storage unavailable'); },
      save: async () => {}, consumeCode: async () => {},
    });
    // No HTTP request can run when storage cannot be read.
    await assert.rejects(session.ensure(), /storage unavailable/);
    assert.equal(requests, 0);
  } finally { await f.close(); }
});

test('a connection failure does not fall back to a credential login', async () => {
  let requests = 0;
  const f = await fixture((req) => { requests++; req.socket.destroy(); });
  try {
    const session = f.makeSession();
    await assert.rejects(session.ensure());
    await assert.rejects(session.ensure());
    assert.equal(requests, 1);
  } finally { await f.close(); }
});

test('a forbidden resource does not invalidate a valid login', async () => {
  let basic = 0;
  const f = await fixture((req, res) => {
    if (req.url === '/private-world') return reply(res, 403, {});
    if (req.headers.authorization) { basic++; return reply(res, 200, user, ['auth=valid; Path=/']); }
    reply(res, req.headers.cookie ? 200 : 401, user);
  });
  try {
    const session = f.makeSession();
    await session.ensure();
    await assert.rejects(session.read(() => session.client.get('/private-world')));
    assert.equal((await session.ensure()).id, user.id);
    assert.equal(basic, 1);
  } finally { await f.close(); }
});
