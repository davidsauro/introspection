import { normalizeDay, isEmptyDay } from '../stores/day.js';

// Builds everything History and the PDF report need for a date range.
// `rawDays` is the /api/days?from&to response; `dates` is every date in the range.
// Days that exist but hold nothing (e.g. everything was cleared) count as no entry.
export function buildReport(catalog, rawDays, dates) {
  const days = Object.fromEntries(
    rawDays
      .map(normalizeDay)
      .filter((d) => !isEmptyDay(d))
      .map((d) => [d.date, d])
  );

  // Archived items only appear if they have data in this range.
  const hasRating = (t) => dates.some((d) => days[d]?.ratings[t.id]);
  const hasMed = (m) => dates.some((d) => days[d]?.medications[m.id] !== undefined);
  const emotions = catalog.emotions.filter((t) => !t.archived || hasRating(t));
  const urges = catalog.urges.filter((t) => !t.archived || hasRating(t));
  const medications = catalog.medications.filter((m) => !m.archived || hasMed(m));

  const trackerStats = (t) => {
    const points = dates.map((date) => {
      const r = days[date]?.ratings[t.id];
      return { date, value: r?.value ?? null, scaleMax: r?.scaleMax ?? t.scaleMax, actedOn: r?.actedOn ?? null };
    });
    const rated = points.filter((p) => p.value !== null);
    return {
      tracker: t,
      points,
      // The chart's y-axis spans the largest scale used in the range.
      scaleMax: Math.max(t.scaleMax, ...rated.map((p) => p.scaleMax)),
      daysRated: rated.length,
      average: rated.length ? rated.reduce((s, p) => s + p.value, 0) / rated.length : null,
      max: rated.length ? Math.max(...rated.map((p) => p.value)) : null,
      daysActed: points.filter((p) => p.actedOn === true).length,
    };
  };

  const medStats = (m) => {
    const taken = dates.map((date) => days[date]?.medications[m.id] ?? null);
    const recorded = taken.filter((v) => v !== null).length;
    const yes = taken.filter((v) => v === true).length;
    return { medication: m, taken, recorded, yes, percent: recorded ? Math.round((yes / recorded) * 100) : null };
  };

  return {
    dates,
    days,
    emotions: emotions.map(trackerStats),
    urges: urges.map(trackerStats),
    medications: medications.map(medStats),
    daysWithEntries: dates.filter((d) => days[d]).length,
  };
}

export const formatNumber = (n) => (n === null ? '–' : Number.isInteger(n) ? String(n) : n.toFixed(1));
