import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { Readable } from 'node:stream';
import axios from 'axios';
import { loadProfile } from './profile';
import { downloadVRCImage } from './utils';
import { profileImages } from '../src/types/profile';

test('modern profiles fetch bio on demand and fall back from an unavailable icon to the avatar', async () => {
  const paths: string[] = [];
  const server = createServer((req, res) => {
    paths.push(req.url!);
    assert.equal(req.headers.authorization, undefined);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id: 'usr_alice', bio: 'Line one\nLine two', pronouns: 'she/her',
      iconUrl: 'https://example.test/icon.png', currentAvatarThumbnailImageUrl: 'https://example.test/avatar.jpg',
      authToken: 'must-not-be-forwarded',
    }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const client = axios.create({ baseURL: `http://127.0.0.1:${address.port}` });
  const downloads: string[] = [];
  let reads = 0;
  try {
    const profile = await loadProfile('usr_alice', client, async operation => { reads++; return operation(); }, async url => {
      downloads.push(url);
      return url.endsWith('avatar.jpg') ? 'http://localhost:8891/resource/image/vrchat/avatar.jpg' : undefined;
    });
    assert.deepEqual(paths, ['/profile/usr_alice']);
    assert.equal(reads, 1);
    assert.deepEqual(downloads, ['https://example.test/icon.png', 'https://example.test/avatar.jpg']);
    assert.deepEqual(profile, { id: 'usr_alice', bio: 'Line one\nLine two', pronouns: 'she/her', imageUrl: 'http://localhost:8891/resource/image/vrchat/avatar.jpg' });
  } finally { server.closeAllConnections(); server.close(); await once(server, 'close'); }
});

test('legacy profile endpoint fallback happens only on HTTP 404', async () => {
  const paths: string[] = [];
  const client = axios.create({ adapter: async config => {
    paths.push(config.url!);
    if (config.url?.startsWith('/profile/')) {
      throw new axios.AxiosError('not found', 'ERR_BAD_REQUEST', config, undefined, {
        status: 404, statusText: 'Not Found', headers: {}, config, data: {},
      });
    }
    return { status: 200, statusText: 'OK', headers: {}, config, data: { id: 'usr_legacy', bio: 'Legacy bio' } };
  } });
  const profile = await loadProfile('usr_legacy', client, operation => operation());
  assert.equal(profile.bio, 'Legacy bio');
  assert.deepEqual(paths, ['/profile/usr_legacy', '/users/usr_legacy']);
});

test('a throttled profile does not fall back to another endpoint', async () => {
  let calls = 0;
  const client = axios.create({ adapter: async config => {
    calls++;
    throw new axios.AxiosError('rate limited', 'ERR_BAD_REQUEST', config, undefined, {
      status: 429, statusText: 'Too Many Requests', headers: {}, config, data: {},
    });
  } });
  await assert.rejects(loadProfile('usr_alice', client, operation => operation()));
  assert.equal(calls, 1);
});

test('missing optional fields and failed images do not discard a bio', async () => {
  const client = axios.create({ adapter: async config => ({ status: 200, statusText: 'OK', headers: {}, config,
    data: { id: 'usr_alice', bio: '', iconUrl: 'https://example.test/missing' },
  }) });
  const profile = await loadProfile('usr_alice', client, operation => operation(), async () => undefined);
  assert.equal(profile.bio, '');
  assert.equal(profile.imageUrl, undefined);
  assert.equal(profile.pronouns, undefined);
});

test('image candidates support current and legacy fields without duplicates', () => {
  assert.deepEqual(profileImages({ iconUrl: ' https://example.test/icon ', userIcon: '',
    profilePicOverride: 'https://example.test/legacy', currentAvatarThumbnailImageUrl: 'https://example.test/icon',
  }), ['https://example.test/icon', 'https://example.test/legacy']);
});

test('image files match response format and DeskThing routing; no extra auth request is made', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vrchat-images-'));
  const paths: string[] = [];
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const client = axios.create({ adapter: async config => {
    paths.push(config.url!);
    return { status: 200, statusText: 'OK', config, headers: { 'content-type': 'image/jpeg' }, data: Readable.from([bytes]) };
  } });
  try {
    const url = await downloadVRCImage('https://example.test/picture', client, 'usr_alice', directory);
    assert.match(url!, /^http:\/\/localhost:8891\/resource\/image\/vrchat\/usr_alice_[a-f0-9]{12}\.jpg$/);
    const filename = new URL(url!).pathname.split('/').pop()!;
    assert.deepEqual(await readFile(join(directory, filename)), bytes);
    assert.deepEqual(await readdir(directory), [filename]);
    assert.deepEqual(paths, ['https://example.test/picture']);
  } finally {
    assert.equal(dirname(directory), tmpdir());
    await rm(directory, { recursive: true, force: true });
  }
});

test('HTML responses are never saved as profile pictures', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vrchat-images-'));
  const client = axios.create({ adapter: async config => ({ status: 200, statusText: 'OK', config,
    headers: { 'content-type': 'text/html' }, data: Readable.from(['<html>Access denied</html>']),
  }) });
  try {
    assert.equal(await downloadVRCImage('https://example.test/image', client, 'usr_alice', directory), undefined);
    assert.deepEqual(await readdir(directory), []);
  } finally {
    assert.equal(dirname(directory), tmpdir());
    await rm(directory, { recursive: true, force: true });
  }
});
