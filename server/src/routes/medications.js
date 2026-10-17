import express from 'express';
import { db } from '../db.js';
import { HttpError, assertName, assertBool, reorder } from '../util.js';

export const medicationsRouter = express.Router();

const toApi = (row) => ({
  id: row.id,
  name: row.name,
  dose: row.dose ?? '',
  sortOrder: row.sort_order,
  archived: !!row.archived_at,
});

function getMedication(id) {
  const row = db.prepare('SELECT * FROM medications WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, 'Medication not found');
  return row;
}

function assertDose(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > 60) throw new HttpError(400, 'dose must be at most 60 characters');
  return value.trim() || null;
}

medicationsRouter.get('/', (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  const rows = db
    .prepare(`SELECT * FROM medications ${includeArchived ? '' : 'WHERE archived_at IS NULL'} ORDER BY sort_order, id`)
    .all();
  res.json(rows.map(toApi));
});

medicationsRouter.post('/', (req, res) => {
  const { name, dose } = req.body ?? {};
  const next = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM medications').get().n;
  const { lastInsertRowid } = db
    .prepare('INSERT INTO medications (name, dose, sort_order) VALUES (?, ?, ?)')
    .run(assertName(name), assertDose(dose), next);
  res.status(201).json(toApi(getMedication(lastInsertRowid)));
});

medicationsRouter.put('/order', (req, res) => {
  reorder(db, 'medications', req.body);
  res.json({ ok: true });
});

medicationsRouter.patch('/:id', (req, res) => {
  const row = getMedication(Number(req.params.id));
  const b = req.body ?? {};
  const name = b.name !== undefined ? assertName(b.name) : row.name;
  const dose = b.dose !== undefined ? assertDose(b.dose) : row.dose;
  let archivedAt = row.archived_at;
  if (b.archived !== undefined) {
    archivedAt = assertBool(b.archived, 'archived') ? (row.archived_at ?? new Date().toISOString()) : null;
  }
  db.prepare('UPDATE medications SET name = ?, dose = ?, archived_at = ? WHERE id = ?').run(name, dose, archivedAt, row.id);
  res.json(toApi(getMedication(row.id)));
});
