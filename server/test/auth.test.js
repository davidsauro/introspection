import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, PASSWORD } from './helpers.js';

let srv;
before(async () => (srv = await startServer()));
after(() => srv.close());

test('fresh install reports setup required and protects the API', async () => {
  const c = srv.client();
  assert.deepEqual((await c.get('/api/auth/status')).data, { setupRequired: true, authenticated: false });
  for (const url of ['/api/trackers', '/api/medications', '/api/days/2026-01-01']) {
    assert.equal((await c.get(url)).status, 401, url);
  }
});

test('setup rejects passwords that are too short, too long or not strings', async () => {
  const c = srv.client();
  for (const password of ['short', 'x'.repeat(201), 12345678, undefined]) {
    const res = await c.post('/api/auth/setup', { password });
    assert.equal(res.status, 400, String(password));
  }
  assert.equal((await c.get('/api/auth/status')).data.setupRequired, true);
});

test('concurrent setup requests: exactly one wins', async () => {
  const [a, b] = [srv.client(), srv.client()];
  const results = await Promise.all([
    a.post('/api/auth/setup', { password: PASSWORD }),
    b.post('/api/auth/setup', { password: PASSWORD }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);

  const winner = results[0].status === 200 ? a : b;
  assert.equal((await winner.get('/api/auth/status')).data.authenticated, true);
  assert.equal((await winner.get('/api/trackers')).status, 200);
});

test('setup cannot run twice', async () => {
  const res = await srv.client().post('/api/auth/setup', { password: 'takeover123' });
  assert.equal(res.status, 409);
});

test('login: wrong password, missing password, then success', async () => {
  const c = srv.client();
  assert.equal((await c.post('/api/auth/login', {})).status, 401);
  assert.equal((await c.post('/api/auth/login', { password: 'wrong password' })).status, 401);
  assert.equal((await c.post('/api/auth/login', { password: PASSWORD })).status, 200);
  assert.equal((await c.get('/api/trackers')).status, 200);
});

test('logout ends the session', async () => {
  const c = srv.client();
  assert.equal((await c.post('/api/auth/login', { password: PASSWORD })).status, 200);
  const stolen = c.cookie;
  await c.post('/api/auth/logout');
  assert.equal((await c.get('/api/trackers')).status, 401);
  // The old cookie must not work either.
  c.cookie = stolen;
  assert.equal((await c.get('/api/trackers')).status, 401);
});

test('changing the password logs out other devices but keeps this one', async () => {
  const phone = srv.client();
  const laptop = srv.client();
  const current = PASSWORD;
  assert.equal((await phone.post('/api/auth/login', { password: current })).status, 200);
  assert.equal((await laptop.post('/api/auth/login', { password: current })).status, 200);

  assert.equal((await phone.post('/api/auth/password', { currentPassword: 'nope', newPassword: 'new password 1' })).status, 401);
  assert.equal((await phone.post('/api/auth/password', { currentPassword: current, newPassword: 'short' })).status, 400);
  assert.equal((await phone.post('/api/auth/password', { currentPassword: current, newPassword: 'new password 1' })).status, 200);

  assert.equal((await phone.get('/api/trackers')).status, 200);
  assert.equal((await laptop.get('/api/trackers')).status, 401);
  assert.equal((await srv.client().post('/api/auth/login', { password: current })).status, 401);
  assert.equal((await srv.client().post('/api/auth/login', { password: 'new password 1' })).status, 200);
});

test('login is rate limited after repeated failures', async () => {
  const { resetLoginLimiter } = await import('../src/auth.js');
  resetLoginLimiter();
  const c = srv.client();
  for (let i = 0; i < 10; i++) assert.equal((await c.post('/api/auth/login', { password: 'guess' + i })).status, 401);
  // Even the right password is refused while limited.
  assert.equal((await c.post('/api/auth/login', { password: 'new password 1' })).status, 429);
  resetLoginLimiter();
  assert.equal((await c.post('/api/auth/login', { password: 'new password 1' })).status, 200);
});

test('malformed JSON is a 400, not a crash', async () => {
  const res = await srv.client().request('POST', '/api/auth/login', '{"password":', {});
  assert.equal(res.status, 400);
});

test('unknown API routes are JSON 404s', async () => {
  const c = srv.client();
  await c.post('/api/auth/login', { password: 'new password 1' });
  const res = await c.get('/api/nope');
  assert.equal(res.status, 404);
  assert.equal(res.data.error, 'Not found');
});
