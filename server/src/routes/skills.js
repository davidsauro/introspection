import express from 'express';
import { db } from '../db.js';
import { MODULES } from '../skills-seed.js';
import { HttpError, assertName, assertBool, reorder } from '../util.js';

export const skillsRouter = express.Router();

const MAX_DESCRIPTION = 300;

const toApi = (row) => ({
  id: row.id,
  module: row.module,
  name: row.name,
  description: row.description,
  starred: !!row.starred, // shown on the Day screen
  sortOrder: row.sort_order,
  archived: !!row.archived_at,
});

// Modules in DBT's usual order (mindfulness first), not alphabetical.
const MODULE_ORDER = `CASE s.module ${MODULES.map((m, i) => `WHEN '${m}' THEN ${i}`).join(' ')} END`;

const SELECT = 'SELECT s.* FROM skills s';

function getSkill(id) {
  const row = db.prepare(`${SELECT} WHERE s.id = ?`).get(id);
  if (!row) throw new HttpError(404, 'Skill not found');
  return row;
}

function assertModule(value) {
  if (!MODULES.includes(value)) throw new HttpError(400, `module must be one of ${MODULES.join(', ')}`);
  return value;
}

function assertDescription(value) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > MAX_DESCRIPTION) {
    throw new HttpError(400, `description must be at most ${MAX_DESCRIPTION} characters`);
  }
  return value.trim();
}

skillsRouter.get('/', (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  const rows = db
    .prepare(`${SELECT} ${includeArchived ? '' : 'WHERE s.archived_at IS NULL'} ORDER BY ${MODULE_ORDER}, s.sort_order, s.id`)
    .all();
  res.json(rows.map(toApi));
});

skillsRouter.post('/', (req, res) => {
  const { module, name, description } = req.body ?? {};
  assertModule(module);
  const next = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM skills WHERE module = ?').get(module).n;
  const { lastInsertRowid } = db
    .prepare('INSERT INTO skills (module, name, description, sort_order) VALUES (?, ?, ?, ?)')
    .run(module, assertName(name), assertDescription(description), next);
  res.status(201).json(toApi(getSkill(lastInsertRowid)));
});

skillsRouter.put('/order', (req, res) => {
  reorder(db, 'skills', req.body);
  res.json({ ok: true });
});

skillsRouter.patch('/:id', (req, res) => {
  const row = getSkill(Number(req.params.id));
  const b = req.body ?? {};
  const name = b.name !== undefined ? assertName(b.name) : row.name;
  const description = b.description !== undefined ? assertDescription(b.description) : row.description;
  let module = row.module;
  let sortOrder = row.sort_order;
  if (b.module !== undefined && assertModule(b.module) !== row.module) {
    // Moving to another module puts it at the end of that module.
    module = b.module;
    sortOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM skills WHERE module = ?').get(module).n;
  }
  const starred = b.starred !== undefined ? (assertBool(b.starred, 'starred') ? 1 : 0) : row.starred;
  let archivedAt = row.archived_at;
  if (b.archived !== undefined) {
    archivedAt = assertBool(b.archived, 'archived') ? (row.archived_at ?? new Date().toISOString()) : null;
  }
  db.prepare('UPDATE skills SET name = ?, description = ?, module = ?, sort_order = ?, starred = ?, archived_at = ? WHERE id = ?').run(
    name,
    description,
    module,
    sortOrder,
    starred,
    archivedAt,
    row.id
  );
  res.json(toApi(getSkill(row.id)));
});
