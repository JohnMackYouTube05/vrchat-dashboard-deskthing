import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Worker } from 'node:worker_threads';

test('packaged server boots and normalizes legacy settings through the DeskThing bridge', { timeout: 10_000 }, async () => {
  const field = (id, value) => ({ id, value, type: 'string', label: id });
  let settings = {
    email: field('email', 'example-user'),
    password: field('password', 'example-password'),
    twoFactorCode: field('two_factor_code', 'stale-code'),
    cookieJar: field('cookiejar', 'legacy-cookie'),
  };
  const worker = new Worker(new URL('../dist/server/index.js', import.meta.url), { stdout: true, stderr: true });
  try {
    await new Promise((resolve, reject) => {
      worker.on('error', reject);
      worker.on('exit', code => { if (code) reject(new Error(`Worker exited ${code}`)); });
      worker.on('message', message => {
        // DeskThing wraps app bridge messages in { type: 'data', payload }.
        const data = message.type === 'data' ? message.payload : message;
        if (data.type === 'get' && data.request === 'settings') {
          worker.postMessage({ type: 'data', payload: { type: 'settings', payload: settings } });
        }
        if (data.type === 'set' && data.request === 'settings') settings = data.payload;
        if (data.type === 'delete' && data.request === 'settings') {
          try {
            assert.equal(settings.email.value, 'example-user');
            assert.equal(settings.password.value, 'example-password');
            assert.equal(settings.email.label, 'VRChat Username');
            assert.equal(settings.twoFactorCode.id, 'twoFactorCode');
            assert.equal(settings.twoFactorCode.value, '');
            assert(data.payload.includes('cookieJar'));
            resolve();
          } catch (error) { reject(error); }
        }
      });
      worker.postMessage({ type: 'start' });
    });
  } finally { await worker.terminate(); }
});
