import express from 'express';
import { db } from '../db.js';
import { HttpError, assertDate, assertInt, assertBool } from '../util.js';

export const daysRouter = express.Router();

const MAX_RANGE_DAYS = 366;
const MAX_NOTES = 20000;
const MAX_TRACKER_NOTE = 5000;
const FLOWS = ['light', 'medium', 'heavy'];

const emptyDay = (date) => ({ date, notes: '', ratings: [], medications: [], trackerNotes: [], skills: [], period: null });

// Loads days in [from, to] keyed by date. Only dates with something stored are included.
export function loadDays(from, to) {
  const days = new Map();
  const ensure = (date) => {
    if (!days.has(date)) days.set(date, emptyDay(date));
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
  for (const r of db.prepare('SELECT date, tracker_id, note FROM tracker_notes WHERE date BETWEEN ? AND ?').all(from, to)) {
    ensure(r.date).trackerNotes.push({ trackerId: r.tracker_id, note: r.note });
  }
  for (const r of db.prepare('SELECT date, skill_id FROM skill_log WHERE date BETWEEN ? AND ? ORDER BY skill_id').all(from, to)) {
    ensure(r.date).skills.push(r.skill_id);
  }
  for (const r of db.prepare('SELECT date, flow FROM period_log WHERE date BETWEEN ? AND ?').all(from, to)) {
    ensure(r.date).period = { flow: r.flow };
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
  res.json(loadDays(date, date)[0] ?? emptyDay(date));
});

/*
 * Partial update. Only the fields and entries that are sent are changed:
 *   { notes?: string,
 *     ratings?: [{ trackerId, value: int | null, scaleMax?: int, actedOn?: bool | null }],
 *     medications?: [{ medicationId, taken: bool | null }],
 *     trackerNotes?: [{ trackerId, note: string | null }],
 *     skills?: [{ skillId, used: bool }],
 *     period?: { flow: 'light' | 'medium' | 'heavy' | null } | null }
 * A null value/taken clears that entry; a null or blank note deletes it; a null period means
 * no bleeding that day.
 *
 * scaleMax is the scale the value was chosen on. It may be the tracker's current scale, or the
 * scale an existing rating for this day was recorded on (so old entries can be edited in place
 * after the tracker's scale changes). It defaults to the tracker's current scale.
 */
daysRouter.put('/:date', (req, res) => {
  const date = assertDate(req.params.date);
  const { notes, ratings = [], medications = [], trackerNotes = [], skills = [], period } = req.body ?? {};
  if (notes !== undefined && (typeof notes !== 'string' || notes.length > MAX_NOTES)) {
    throw new HttpError(400, `notes must be a string of at most ${MAX_NOTES} characters`);
  }
  if (![ratings, medications, trackerNotes, skills].every(Array.isArray)) {
    throw new HttpError(400, 'ratings, medications, trackerNotes and skills must be arrays');
  }

  for (const r of ratings) {
    if (!Number.isInteger(r?.trackerId)) throw new HttpError(400, 'each rating needs an integer trackerId');
  }
  for (const m of medications) {
    if (!Number.isInteger(m?.medicationId)) throw new HttpError(400, 'each medication needs an integer medicationId');
  }
  for (const n of trackerNotes) {
    if (!Number.isInteger(n?.trackerId)) throw new HttpError(400, 'each tracker note needs an integer trackerId');
    if (n.note !== null && (typeof n.note !== 'string' || n.note.length > MAX_TRACKER_NOTE)) {
      throw new HttpError(400, `a tracker note must be a string of at most ${MAX_TRACKER_NOTE} characters`);
    }
  }
  for (const s of skills) {
    if (!Number.isInteger(s?.skillId)) throw new HttpError(400, 'each skill needs an integer skillId');
    assertBool(s.used, 'used');
  }
  if (period !== undefined && period !== null) {
    if (typeof period !== 'object' || !(period.flow == null || FLOWS.includes(period.flow))) {
      throw new HttpError(400, `period must be null or { flow: ${FLOWS.join(' | ')} | null }`);
    }
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
  const upsertNote = db.prepare(
    `INSERT INTO tracker_notes (date, tracker_id, note) VALUES (?, ?, ?)
     ON CONFLICT(date, tracker_id) DO UPDATE SET note = excluded.note`
  );
  const deleteNote = db.prepare('DELETE FROM tracker_notes WHERE date = ? AND tracker_id = ?');
  const getSkill = db.prepare('SELECT id FROM skills WHERE id = ?');
  const logSkill = db.prepare('INSERT OR IGNORE INTO skill_log (date, skill_id) VALUES (?, ?)');
  const unlogSkill = db.prepare('DELETE FROM skill_log WHERE date = ? AND skill_id = ?');

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

    for (const n of trackerNotes) {
      if (!getTracker.get(n.trackerId)) throw new HttpError(400, `Unknown tracker ${n.trackerId}`);
      // Stored as typed (line breaks and all); a blank note is the same as no note.
      if (n.note === null || !n.note.trim()) deleteNote.run(date, n.trackerId);
      else upsertNote.run(date, n.trackerId, n.note);
    }

    for (const s of skills) {
      if (!getSkill.get(s.skillId)) throw new HttpError(400, `Unknown skill ${s.skillId}`);
      if (s.used) logSkill.run(date, s.skillId);
      else unlogSkill.run(date, s.skillId);
    }

    if (period === null) db.prepare('DELETE FROM period_log WHERE date = ?').run(date);
    else if (period !== undefined) {
      db.prepare(
        `INSERT INTO period_log (date, flow) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET flow = excluded.flow`
      ).run(date, period.flow ?? null);
    }
  })();

  res.json(loadDays(date, date)[0]);
});
