import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Starts the app on a random port against a fresh temporary database.
// Must run before anything imports src/db.js, which opens DB_PATH on import.
export async function startServer(env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'diary-test-'));
  process.env.DB_PATH = path.join(dir, 'test.db');
  process.env.PUBLIC_DIR = path.join(dir, 'no-public');
  Object.assign(process.env, env);

  const { app } = await import('../src/app.js');
  const { db } = await import('../src/db.js');
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    base,
    db,
    client: () => new Client(base),
    async close() {
      await new Promise((r) => server.close(r));
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

// Minimal HTTP client with a one-cookie jar (the app only uses diary.sid).
export class Client {
  constructor(base) {
    this.base = base;
    this.cookie = '';
  }

  async request(method, url, body, headers = {}) {
    const res = await fetch(this.base + url, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(this.cookie && { cookie: this.cookie }),
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const [pair] = setCookie.split(';');
      this.cookie = pair.endsWith('=') ? '' : pair;
    }
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : await res.arrayBuffer();
    return { status: res.status, data, headers: res.headers };
  }

  get(url) {
    return this.request('GET', url);
  }
  post(url, body = {}, headers) {
    return this.request('POST', url, body, headers);
  }
  put(url, body) {
    return this.request('PUT', url, body);
  }
  patch(url, body) {
    return this.request('PATCH', url, body);
  }
}

export const PASSWORD = 'correct horse';

// A client that has completed first-run setup and is logged in.
export async function loggedIn(srv) {
  const c = srv.client();
  const { status } = await c.post('/api/auth/setup', { password: PASSWORD });
  if (status !== 200) await c.post('/api/auth/login', { password: PASSWORD });
  return c;
}
