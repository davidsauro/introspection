import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, PASSWORD } from './helpers.js';

// COOKIE_SECURE=true is the production setting (behind an HTTPS reverse proxy).
// The test client connects to 127.0.0.1; to look like another device on the network it sends
// the hostname a proxy would forward.
const FROM_LAN = { 'X-Forwarded-Host': 'diary.lan' };
const VIA_HTTPS_PROXY = { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'diary.example.com' };

let srv;
before(async () => (srv = await startServer({ COOKIE_SECURE: 'true' })));
after(() => srv.close());

test('over plain HTTP from another device, setup is refused with an explanation', async () => {
  const c = srv.client();
  const res = await c.post('/api/auth/setup', { password: PASSWORD }, FROM_LAN);
  assert.equal(res.status, 400);
  assert.match(res.data.error, /HTTPS/);
  // Nothing was set up, so a later visit over HTTPS can still do setup.
  assert.equal((await c.get('/api/auth/status')).data.setupRequired, true);
});

test('through the HTTPS proxy, setup works and the cookie is Secure', async () => {
  const c = srv.client();
  const res = await c.post('/api/auth/setup', { password: PASSWORD }, VIA_HTTPS_PROXY);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('set-cookie'), /;\s*Secure/i);
  assert.match(res.headers.get('set-cookie'), /;\s*HttpOnly/i);
});

test('over plain HTTP from another device, login is refused with an explanation', async () => {
  const res = await srv.client().post('/api/auth/login', { password: PASSWORD }, FROM_LAN);
  assert.equal(res.status, 400);
  assert.match(res.data.error, /HTTPS/);
});

test('over plain HTTP on localhost, login works with a non-Secure cookie', async () => {
  for (const host of ['localhost', '127.0.0.1']) {
    const c = srv.client();
    const res = await c.post('/api/auth/login', { password: PASSWORD }, { 'X-Forwarded-Host': `${host}:3000` });
    assert.equal(res.status, 200, host);
    const cookie = res.headers.get('set-cookie');
    assert.match(cookie, /;\s*HttpOnly/i);
    assert.doesNotMatch(cookie, /;\s*Secure/i, 'a Secure cookie would be dropped over plain HTTP');
    assert.equal((await c.get('/api/trackers')).status, 200, host);
  }
});

test('a hostname that merely starts with "localhost" is not localhost', async () => {
  const res = await srv.client().post('/api/auth/login', { password: PASSWORD }, { 'X-Forwarded-Host': 'localhost.evil.example' });
  assert.equal(res.status, 400);
});
