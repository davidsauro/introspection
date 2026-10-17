export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function assertDate(value, name = 'date') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${name} must be YYYY-MM-DD`);
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `${name} is not a valid date`);
  }
  return value;
}

export function assertName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 60) {
    throw new HttpError(400, 'name must be 1-60 characters');
  }
  return value.trim();
}

export function assertInt(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new HttpError(400, `${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

export function assertBool(value, name) {
  if (typeof value !== 'boolean') throw new HttpError(400, `${name} must be true or false`);
  return value;
}

// Rewrites sort_order for the given ids (in that order) inside one transaction.
export function reorder(db, table, ids) {
  if (!Array.isArray(ids) || !ids.every(Number.isInteger)) {
    throw new HttpError(400, 'Body must be an array of ids');
  }
  const stmt = db.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`);
  db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))();
}

export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
