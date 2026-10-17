import express from 'express';
import { db } from '../db.js';
import { HttpError, assertDate, assertInt, assertBool } from '../util.js';

export const daysRouter = express.Router();

const MAX_RANGE_DAYS = 366;

// Loads days in [from, to] keyed by date. Only dates with something stored are included.
export function loadDays(from, to) {
  const days = new Map();
  const ensure = (date) => {
    if (!days.has(date)) days.set(date, { date, notes: '', ratings: [], medications: [] });
    return days.get(date);
  };

  for (const r of db.prepare('SELECT date, notes FROM days WHERE date BETWEEN ? AND ?').all(from, to)) {
    ensure(r.date).notes = r.notes ?? '';
  }
  for (const r of db
    .prepare('SELECT date, tracker_id, value, scale_max, acted_on FROM ratings WHERE date BETWEEN ? AND ?')
    .all(from, to)) {
    ensure(r.date).ratings.push({
      trackerId: r.tracker_id,
      value: r.value,
      scaleMax: r.scale_max,
      actedOn: r.acted_on === null ? null : !!r.acted_on,
    });
  }
  for (const r of db
    .prepare('SELECT date, medication_id, taken FROM medication_log WHERE date BETWEEN ? AND ?')
    .all(from, to)) {
    ensure(r.date).medications.push({ medicationId: r.medication_id, taken: !!r.taken });
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

daysRouter.get('/', (req, res) => {
  const from = assertDate(req.query.from, 'from');
  const to = assertDate(req.query.to, 'to');
  if (from > to) throw new HttpError(400, 'from must be on or before to');
  if ((Date.parse(to) - Date.parse(from)) / 864e5 >= MAX_RANGE_DAYS) {
    throw new HttpError(400, `Range must be at most ${MAX_RANGE_DAYS} days`);
  }
  res.json(loadDays(from, to));
});

daysRouter.get('/:date', (req, res) => {
  const date = assertDate(req.params.date);
  res.json(loadDays(date, date)[0] ?? { date, notes: '', ratings: [], medications: [] });
});

/*
 * Partial update. Only the fields and entries that are sent are changed:
 *   { notes?: string,
 *     ratings?: [{ trackerId, value: int | null, scaleMax?: int, actedOn?: bool | null }],
 *     medications?: [{ medicationId, taken: bool | null }] }
 * A null value/taken clears that entry.
 *
 * scaleMax is the scale the value was chosen on. It may be the tracker's current scale, or the
 * scale an existing rating for this day was recorded on (so old entries can be edited in place
 * after the tracker's scale changes). It defaults to the tracker's current scale.
 */
daysRouter.put('/:date', (req, res) => {
  const date = assertDate(req.params.date);
  const { notes, ratings = [], medications = [] } = req.body ?? {};
  if (notes !== undefined && (typeof notes !== 'string' || notes.length > 20000)) {
    throw new HttpError(400, 'notes must be a string of at most 20000 characters');
  }
  if (!Array.isArray(ratings) || !Array.isArray(medications)) {
    throw new HttpError(400, 'ratings and medications must be arrays');
  }

  for (const r of ratings) {
    if (!Number.isInteger(r?.trackerId)) throw new HttpError(400, 'each rating needs an integer trackerId');
  }
  for (const m of medications) {
    if (!Number.isInteger(m?.medicationId)) throw new HttpError(400, 'each medication needs an integer medicationId');
  }

  const getTracker = db.prepare('SELECT id, scale_max FROM trackers WHERE id = ?');
  const getExisting = db.prepare('SELECT scale_max FROM ratings WHERE date = ? AND tracker_id = ?');
  const getMedication = db.prepare('SELECT id FROM medications WHERE id = ?');
  const upsertRating = db.prepare(
    `INSERT INTO ratings (date, tracker_id, value, scale_max, acted_on) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date, tracker_id) DO UPDATE SET
       value = excluded.value, scale_max = excluded.scale_max, acted_on = excluded.acted_on`
  );
  const deleteRating = db.prepare('DELETE FROM ratings WHERE date = ? AND tracker_id = ?');
  const upsertMed = db.prepare(
    `INSERT INTO medication_log (date, medication_id, taken) VALUES (?, ?, ?)
     ON CONFLICT(date, medication_id) DO UPDATE SET taken = excluded.taken`
  );
  const deleteMed = db.prepare('DELETE FROM medication_log WHERE date = ? AND medication_id = ?');

  db.transaction(() => {
    db.prepare(
      `INSERT INTO days (date, notes, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(date) DO UPDATE SET notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP`
    ).run(date, notes ?? null, notes ?? null);

    for (const r of ratings) {
      const tracker = getTracker.get(r.trackerId);
      if (!tracker) throw new HttpError(400, `Unknown tracker ${r.trackerId}`);
      if (r.value === null) {
        deleteRating.run(date, tracker.id);
        continue;
      }
      const existing = getExisting.get(date, tracker.id);
      const scaleMax = r.scaleMax ?? tracker.scale_max;
      if (scaleMax !== tracker.scale_max && scaleMax !== existing?.scale_max) {
        throw new HttpError(400, `scaleMax must be ${tracker.scale_max} (the tracker's current scale)`);
      }
      const value = assertInt(r.value, 'value', 0, scaleMax);
      // Stored whenever sent, even if the tracker no longer asks, so editing an old entry keeps it.
      const actedOn = r.actedOn == null ? null : assertBool(r.actedOn, 'actedOn') ? 1 : 0;
      upsertRating.run(date, tracker.id, value, scaleMax, actedOn);
    }

    for (const m of medications) {
      const med = getMedication.get(m.medicationId);
      if (!med) throw new HttpError(400, `Unknown medication ${m.medicationId}`);
      if (m.taken === null) deleteMed.run(date, med.id);
      else upsertMed.run(date, med.id, assertBool(m.taken, 'taken') ? 1 : 0);
    }
  })();

  res.json(loadDays(date, date)[0]);
});
