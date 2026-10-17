import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import { db, getSetting, setSetting } from './db.js';

const SESSION_DAYS = 30;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

class SqliteStore extends session.Store {
  constructor() {
    super();
    this.getStmt = db.prepare('SELECT data, expires FROM sessions WHERE sid = ?');
    this.setStmt = db.prepare(
      'INSERT INTO sessions (sid, data, expires) VALUES (?, ?, ?) ' +
        'ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires = excluded.expires'
    );
    this.destroyStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.touchStmt = db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
    this.pruneStmt = db.prepare('DELETE FROM sessions WHERE expires < ?');
    setInterval(() => this.pruneStmt.run(Date.now()), 60 * 60 * 1000).unref();
  }

  expiry(sess) {
    return sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + SESSION_DAYS * 864e5;
  }

  get(sid, cb) {
    const row = this.getStmt.get(sid);
    if (!row || row.expires < Date.now()) return cb(null, null);
    cb(null, JSON.parse(row.data));
  }

  set(sid, sess, cb) {
    this.setStmt.run(sid, JSON.stringify(sess), this.expiry(sess));
    cb?.(null);
  }

  destroy(sid, cb) {
    this.destroyStmt.run(sid);
    cb?.(null);
  }

  touch(sid, sess, cb) {
    this.touchStmt.run(this.expiry(sess), sid);
    cb?.(null);
  }
}

export const sessionMiddleware = session({
  name: 'diary.sid',
  secret: getSetting('session_secret'),
  store: new SqliteStore(),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    // 'auto': Secure over HTTPS (via the proxy), plain over HTTP. Plain HTTP logins are only
    // allowed from localhost while COOKIE_SECURE is on; see insecureCookieProblem().
    secure: COOKIE_SECURE ? 'auto' : false,
    maxAge: SESSION_DAYS * 864e5,
  },
});

export function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  res.status(401).json({ error: 'Not logged in' });
}

// Simple in-memory limiter: at most 10 failed logins per IP per 15 minutes.
const failures = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

function isLimited(ip) {
  const entry = failures.get(ip);
  if (!entry || entry.resetAt < Date.now()) return false;
  return entry.count >= MAX_FAILURES;
}

function recordFailure(ip) {
  const entry = failures.get(ip);
  if (!entry || entry.resetAt < Date.now()) {
    failures.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    entry.count++;
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of failures) if (entry.resetAt < now) failures.delete(ip);
}, WINDOW_MS).unref();

export function resetLoginLimiter() {
  failures.clear();
}

function validPassword(pw) {
  return typeof pw === 'string' && pw.length >= MIN_PASSWORD && pw.length <= MAX_PASSWORD;
}

const passwordRule = `Password must be ${MIN_PASSWORD}-${MAX_PASSWORD} characters`;

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// Opened as http://localhost:PORT on the server itself (e.g. for testing). Judged by the
// hostname in the request, not the client IP: inside Docker, requests from the host arrive
// from the bridge gateway, not loopback. A client that fakes the hostname only exposes its
// own traffic, which is the risk HTTPS-only login is there to prevent.
function isLocalhost(req) {
  return LOCAL_HOSTNAMES.has(req.hostname);
}

// With COOKIE_SECURE on, logins must come over HTTPS, apart from localhost. Refusing up front
// (with an explanation) beats a silent login loop from a cookie the browser won't keep.
function insecureCookieProblem(req) {
  if (COOKIE_SECURE && !req.secure && !isLocalhost(req)) {
    return 'This server only allows logging in over HTTPS (or from localhost). Open it through your HTTPS address, or set COOKIE_SECURE=false.';
  }
  return null;
}

function logIn(req, res) {
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.authenticated = true;
    res.json({ authenticated: true });
  });
}

export const authRouter = express.Router();

authRouter.get('/status', (req, res) => {
  res.json({
    setupRequired: !getSetting('password_hash'),
    authenticated: !!req.session?.authenticated,
  });
});

authRouter.post('/setup', async (req, res) => {
  if (getSetting('password_hash')) return res.status(409).json({ error: 'Already set up' });
  const problem = insecureCookieProblem(req);
  if (problem) return res.status(400).json({ error: problem });
  const { password } = req.body ?? {};
  if (!validPassword(password)) return res.status(400).json({ error: passwordRule });
  const hash = await bcrypt.hash(password, 12);
  // Insert-if-absent, so two setup requests racing through the check above can't both win.
  const { changes } = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('password_hash', ?)").run(hash);
  if (!changes) return res.status(409).json({ error: 'Already set up' });
  logIn(req, res);
});

authRouter.post('/login', async (req, res) => {
  if (isLimited(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  const problem = insecureCookieProblem(req);
  if (problem) return res.status(400).json({ error: problem });
  const hash = getSetting('password_hash');
  const { password } = req.body ?? {};
  if (!hash || typeof password !== 'string' || !(await bcrypt.compare(password, hash))) {
    recordFailure(req.ip);
    return res.status(401).json({ error: 'Incorrect password' });
  }
  failures.delete(req.ip);
  logIn(req, res);
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('diary.sid');
    res.json({ authenticated: false });
  });
});

authRouter.post('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== 'string' || !(await bcrypt.compare(currentPassword, getSetting('password_hash')))) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if (!validPassword(newPassword)) return res.status(400).json({ error: passwordRule });
  setSetting('password_hash', await bcrypt.hash(newPassword, 12));
  // Log out every other device, keeping only this session.
  db.prepare('DELETE FROM sessions WHERE sid != ?').run(req.sessionID);
  res.json({ ok: true });
});
