import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, loggedIn } from './helpers.js';

// Real PDF rendering needs Chromium and the built client. It runs when both are available:
//   (cd ../client && npm run build) && PUPPETEER_EXECUTABLE_PATH=/path/to/chrome npm test
const CLIENT_DIST = path.resolve(import.meta.dirname, '../../client/dist');
const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH;
const canRender = !!CHROME && fs.existsSync(CHROME) && fs.existsSync(path.join(CLIENT_DIST, 'index.html'));

let srv;
let c;
before(async () => {
  // The print page is loaded by Chromium from this same server, so PRINT_BASE_URL must
  // point at the test port; it's set after the port is known (export.js reads it lazily).
  srv = await startServer({ PUBLIC_DIR: CLIENT_DIST });
  process.env.PRINT_BASE_URL = srv.base;
  c = await loggedIn(srv);
});
after(async () => {
  const { closeBrowser } = await import('../src/routes/export.js');
  await closeBrowser();
  await srv.close();
});

test('export requires login', async () => {
  assert.equal((await srv.client().get('/api/export/pdf?from=2026-03-01&to=2026-03-01')).status, 401);
});

test('export validates the range', async () => {
  assert.equal((await c.get('/api/export/pdf?from=2026-03-05&to=2026-03-01')).status, 400);
  assert.equal((await c.get('/api/export/pdf?from=2026-01-01&to=2026-06-01')).status, 400); // > 92 days
  assert.equal((await c.get('/api/export/pdf?from=nope')).status, 400);
  assert.equal((await c.get('/api/export/pdf')).status, 400);
});

test('renders a single-day and a multi-day PDF', { skip: !canRender && 'needs PUPPETEER_EXECUTABLE_PATH and a built client' }, async () => {
  const sadness = (await c.get('/api/trackers')).data.find((t) => t.name === 'Sadness');
  await c.put('/api/days/2026-03-02', { notes: 'hello', ratings: [{ trackerId: sadness.id, value: 3 }] });

  const single = await c.get('/api/export/pdf?from=2026-03-02&to=2026-03-02');
  assert.equal(single.status, 200, JSON.stringify(single.data));
  assert.equal(single.headers.get('content-type'), 'application/pdf');
  assert.match(single.headers.get('content-disposition'), /diary-2026-03-02\.pdf/);
  assert.equal(Buffer.from(single.data).subarray(0, 5).toString(), '%PDF-');

  // `to` defaults to `from`.
  assert.equal((await c.get('/api/export/pdf?from=2026-03-02')).status, 200);

  const range = await c.get('/api/export/pdf?from=2026-03-01&to=2026-03-07');
  assert.equal(range.status, 200);
  assert.match(range.headers.get('content-disposition'), /diary-2026-03-01_to_2026-03-07\.pdf/);
  // Summary pages + one page per day: comfortably more pages than days.
  const pages = Buffer.from(range.data).toString('latin1').match(/\/Type\s*\/Page[^s]/g).length;
  assert.ok(pages >= 8, `expected at least 8 pages, got ${pages}`);
});
