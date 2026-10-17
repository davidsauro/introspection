import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import { db, getSetting, setSetting } from './db.js';

const SESSION_DAYS = 30;
const MIN_PASSWORD = 8;

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
    secure: process.env.COOKIE_SECURE === 'true',
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

function validPassword(pw) {
  return typeof pw === 'string' && pw.length >= MIN_PASSWORD;
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
  const { password } = req.body ?? {};
  if (!validPassword(password)) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });
  }
  setSetting('password_hash', await bcrypt.hash(password, 12));
  logIn(req, res);
});

authRouter.post('/login', async (req, res) => {
  if (isLimited(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
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
  if (!validPassword(newPassword)) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });
  }
  setSetting('password_hash', await bcrypt.hash(newPassword, 12));
  // Log out every other device, keeping only this session.
  db.prepare('DELETE FROM sessions WHERE sid != ?').run(req.sessionID);
  res.json({ ok: true });
});
