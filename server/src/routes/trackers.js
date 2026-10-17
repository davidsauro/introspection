import express from 'express';
import { db } from '../db.js';
import { HttpError, assertName, assertInt, assertBool, reorder } from '../util.js';

export const trackersRouter = express.Router();

const toApi = (row) => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  scaleMax: row.scale_max,
  trackActed: !!row.track_acted,
  sortOrder: row.sort_order,
  archived: !!row.archived_at,
});

function getTracker(id) {
  const row = db.prepare('SELECT * FROM trackers WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, 'Tracker not found');
  return row;
}

trackersRouter.get('/', (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  const rows = db
    .prepare(
      `SELECT * FROM trackers ${includeArchived ? '' : 'WHERE archived_at IS NULL'}
       ORDER BY kind, sort_order, id`
    )
    .all();
  res.json(rows.map(toApi));
});

trackersRouter.post('/', (req, res) => {
  const { kind, name, scaleMax = 5, trackActed = kind === 'urge' } = req.body ?? {};
  if (kind !== 'emotion' && kind !== 'urge') throw new HttpError(400, "kind must be 'emotion' or 'urge'");
  const next = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM trackers WHERE kind = ?').get(kind).n;
  const { lastInsertRowid } = db
    .prepare('INSERT INTO trackers (kind, name, scale_max, track_acted, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(kind, assertName(name), assertInt(scaleMax, 'scaleMax', 1, 10), assertBool(trackActed, 'trackActed') ? 1 : 0, next);
  res.status(201).json(toApi(getTracker(lastInsertRowid)));
});

// Registered before '/:id' so "order" isn't treated as an id.
trackersRouter.put('/order', (req, res) => {
  reorder(db, 'trackers', req.body);
  res.json({ ok: true });
});

trackersRouter.patch('/:id', (req, res) => {
  const row = getTracker(Number(req.params.id));
  const b = req.body ?? {};
  const name = b.name !== undefined ? assertName(b.name) : row.name;
  const scaleMax = b.scaleMax !== undefined ? assertInt(b.scaleMax, 'scaleMax', 1, 10) : row.scale_max;
  const trackActed = b.trackActed !== undefined ? (assertBool(b.trackActed, 'trackActed') ? 1 : 0) : row.track_acted;
  let archivedAt = row.archived_at;
  if (b.archived !== undefined) {
    archivedAt = assertBool(b.archived, 'archived') ? (row.archived_at ?? new Date().toISOString()) : null;
  }
  db.prepare('UPDATE trackers SET name = ?, scale_max = ?, track_acted = ?, archived_at = ? WHERE id = ?').run(
    name,
    scaleMax,
    trackActed,
    archivedAt,
    row.id
  );
  res.json(toApi(getTracker(row.id)));
});
