import express from 'express';
import { db } from '../db.js';
import { assertDate } from '../util.js';

export const statsRouter = express.Router();

// Dates with anything recorded. Matches the client's isEmptyDay(): a day row alone (e.g. after
// everything was cleared) or blank notes don't count. Blank card notes are never stored.
const ENTRY_DATES = `
  SELECT date FROM ratings
  UNION SELECT date FROM medication_log
  UNION SELECT date FROM tracker_notes
  UNION SELECT date FROM skill_log
  UNION SELECT date FROM days WHERE TRIM(COALESCE(notes, '')) != ''
`;

function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/*
 * GET /api/stats?today=YYYY-MM-DD → { streak, skillsUsed, totalEntries }
 * `today` comes from her device, so the streak follows her time zone rather than the server's.
 *   streak:       consecutive days with an entry, counting back from today, or from yesterday
 *                 if today hasn't been logged yet (so it doesn't reset every morning)
 *   skillsUsed:   every skill tick, all time
 *   totalEntries: days with an entry
 */
statsRouter.get('/', (req, res) => {
  const today = assertDate(req.query.today, 'today');
  const dates = new Set(db.prepare(ENTRY_DATES).all().map((r) => r.date));

  let day = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.has(day)) {
    streak++;
    day = addDays(day, -1);
  }

  res.json({
    streak,
    skillsUsed: db.prepare('SELECT COUNT(*) AS n FROM skill_log').get().n,
    totalEntries: dates.size,
  });
});
