import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, PASSWORD } from './helpers.js';

// COOKIE_SECURE=true is the production setting (behind an HTTPS reverse proxy).
let srv;
before(async () => (srv = await startServer({ COOKIE_SECURE: 'true' })));
after(() => srv.close());

test('over plain HTTP, setup is refused with an explanation instead of a silent login loop', async () => {
  const c = srv.client();
  const res = await c.post('/api/auth/setup', { password: PASSWORD });
  assert.equal(res.status, 400);
  assert.match(res.data.error, /HTTPS/);
  // Nothing was set up, so a later visit over HTTPS can still do setup.
  assert.equal((await c.get('/api/auth/status')).data.setupRequired, true);
});

test('through the HTTPS proxy, setup works and the cookie is Secure', async () => {
  const c = srv.client();
  const viaProxy = { 'X-Forwarded-Proto': 'https' };
  const res = await c.post('/api/auth/setup', { password: PASSWORD }, viaProxy);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('set-cookie'), /;\s*Secure/i);
  assert.match(res.headers.get('set-cookie'), /;\s*HttpOnly/i);
});

test('over plain HTTP, login is refused with an explanation', async () => {
  const res = await srv.client().post('/api/auth/login', { password: PASSWORD });
  assert.equal(res.status, 400);
  assert.match(res.data.error, /HTTPS/);
});
