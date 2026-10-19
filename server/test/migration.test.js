import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

// Opening the database runs the migrations; do it in a child process so each run starts fresh.
const DB_MODULE = path.resolve(import.meta.dirname, '../src/db.js');
function openWithApp(dbPath) {
  execFileSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(DB_MODULE)})`], {
    env: { ...process.env, DB_PATH: dbPath },
  });
}

test('a diary from before skills existed (v2) upgrades without losing anything', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'diary-migrate-'));
  const dbPath = path.join(dir, 'diary.db');
  try {
    // Make a current database, then turn it back into a v2 one with some data in it.
    openWithApp(dbPath);
    let db = new Database(dbPath);
    db.exec('DROP TABLE skill_log; DROP TABLE skills; PRAGMA user_version = 2;');
    db.prepare("INSERT INTO ratings (date, tracker_id, value, scale_max) VALUES ('2026-01-01', 1, 3, 5)").run();
    db.prepare("INSERT INTO tracker_notes (date, tracker_id, note) VALUES ('2026-01-01', 1, 'kept')").run();
    db.prepare("UPDATE trackers SET name = 'Renamed' WHERE id = 1").run();
    db.close();

    openWithApp(dbPath);
    db = new Database(dbPath, { readonly: true });
    assert.equal(db.pragma('user_version', { simple: true }), 4);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM skills').get().n, 32);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM skills WHERE starred = 1').get().n, 0);
    assert.equal(db.prepare('SELECT value FROM ratings').get().value, 3);
    assert.equal(db.prepare('SELECT note FROM tracker_notes').get().note, 'kept');
    assert.equal(db.prepare('SELECT name FROM trackers WHERE id = 1').get().name, 'Renamed');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM trackers').get().n, 10); // defaults not re-added
    db.close();

    // Opening again changes nothing.
    openWithApp(dbPath);
    db = new Database(dbPath, { readonly: true });
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM skills').get().n, 32);
    db.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a v3 diary loses its built-in starter skills but keeps its ticks', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'diary-migrate-'));
  const dbPath = path.join(dir, 'diary.db');
  try {
    // Make a current database, then turn it back into a v3 one with starters and a tick.
    openWithApp(dbPath);
    let db = new Database(dbPath);
    db.exec(`
      ALTER TABLE skills RENAME COLUMN starred TO starter;
      UPDATE skills SET starter = 1 WHERE name IN ('Wise Mind', 'Observe', 'GIVE');
      INSERT INTO skill_log (date, skill_id) SELECT '2026-01-01', id FROM skills WHERE name = 'Wise Mind';
      PRAGMA user_version = 3;
    `);
    db.close();

    openWithApp(dbPath);
    db = new Database(dbPath, { readonly: true });
    assert.equal(db.pragma('user_version', { simple: true }), 4);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM skills WHERE starred = 1').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM skill_log').get().n, 1);
    db.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
