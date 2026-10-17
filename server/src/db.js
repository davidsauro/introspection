import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DB_PATH = process.env.DB_PATH || path.resolve('data/diary.db');

function open() {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    return new Database(DB_PATH);
  } catch (err) {
    console.error(
      `Cannot open the database at ${DB_PATH}: ${err.message}\n` +
        `Check that the folder exists and is writable by this process (uid ${process.getuid?.()}).`
    );
    process.exit(1);
  }
}

export const db = open();
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Each entry runs once, in order; PRAGMA user_version records how many have been applied.
const migrations = [
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);

  CREATE TABLE trackers (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('emotion', 'urge')),
    name TEXT NOT NULL,
    scale_max INTEGER NOT NULL DEFAULT 5 CHECK (scale_max BETWEEN 1 AND 10),
    track_acted INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL,
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE days (
    date TEXT PRIMARY KEY,
    notes TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE ratings (
    date TEXT NOT NULL,
    tracker_id INTEGER NOT NULL REFERENCES trackers(id),
    value INTEGER NOT NULL,
    scale_max INTEGER NOT NULL,
    acted_on INTEGER,
    PRIMARY KEY (date, tracker_id)
  );

  CREATE TABLE medications (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    dose TEXT,
    sort_order INTEGER NOT NULL,
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE medication_log (
    date TEXT NOT NULL,
    medication_id INTEGER NOT NULL REFERENCES medications(id),
    taken INTEGER NOT NULL,
    PRIMARY KEY (date, medication_id)
  );

  CREATE TABLE sessions (
    sid TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires INTEGER NOT NULL
  );
  `,
  // v2: a note per emotion/urge per day. Separate from ratings so a note can exist without a
  // rating, and clearing a rating keeps its note.
  `
  CREATE TABLE tracker_notes (
    date TEXT NOT NULL,
    tracker_id INTEGER NOT NULL REFERENCES trackers(id),
    note TEXT NOT NULL,
    PRIMARY KEY (date, tracker_id)
  );
  `,
];

function migrate() {
  const current = db.pragma('user_version', { simple: true });
  for (let v = current; v < migrations.length; v++) {
    db.transaction(() => {
      db.exec(migrations[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
    if (v === 0) seed();
  }
}

function seed() {
  const insert = db.prepare(
    'INSERT INTO trackers (kind, name, scale_max, track_acted, sort_order) VALUES (?, ?, 5, ?, ?)'
  );
  const emotions = ['Sadness', 'Anxiety / Fear', 'Anger', 'Shame', 'Guilt', 'Joy'];
  const urges = ['Self-harm', 'Suicidal thoughts', 'Substance use', 'Isolating'];
  db.transaction(() => {
    emotions.forEach((name, i) => insert.run('emotion', name, 0, i));
    urges.forEach((name, i) => insert.run('urge', name, 1, i));
  })();
}

export function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

migrate();

if (!getSetting('session_secret')) {
  setSetting('session_secret', crypto.randomBytes(32).toString('hex'));
}
