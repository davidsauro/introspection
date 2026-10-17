import { describe, it, expect } from 'vitest';
import { buildReport, formatNumber } from '../src/utils/report.js';
import { dateRange } from '../src/utils/dates.js';

const trackers = [
  { id: 1, kind: 'emotion', name: 'Sadness', scaleMax: 5, trackActed: false, archived: false },
  { id: 2, kind: 'emotion', name: 'Old feeling', scaleMax: 5, trackActed: false, archived: true },
  { id: 3, kind: 'emotion', name: 'Unused archived', scaleMax: 5, trackActed: false, archived: true },
  { id: 4, kind: 'urge', name: 'Self-harm', scaleMax: 5, trackActed: true, archived: false },
  { id: 5, kind: 'urge', name: 'Skip meals', scaleMax: 5, trackActed: true, archived: false },
];
const medications = [
  { id: 1, name: 'Sertraline', archived: false },
  { id: 2, name: 'Never recorded', archived: false },
  { id: 3, name: 'Old med', archived: true },
];
const catalog = {
  emotions: trackers.filter((t) => t.kind === 'emotion'),
  urges: trackers.filter((t) => t.kind === 'urge'),
  medications,
};

const raw = [
  {
    date: '2026-03-01',
    notes: '',
    ratings: [
      { trackerId: 1, value: 2, scaleMax: 5, actedOn: null },
      { trackerId: 2, value: 1, scaleMax: 5, actedOn: null },
      { trackerId: 4, value: 4, scaleMax: 5, actedOn: true },
      { trackerId: 5, value: 8, scaleMax: 10, actedOn: false }, // recorded before the scale was lowered
    ],
    medications: [{ medicationId: 1, taken: true }],
  },
  {
    date: '2026-03-03',
    notes: 'ok',
    ratings: [{ trackerId: 1, value: 5, scaleMax: 5, actedOn: null }, { trackerId: 4, value: 0, scaleMax: 5, actedOn: false }],
    medications: [{ medicationId: 1, taken: false }],
  },
  // A day that exists in the database but has had everything cleared.
  { date: '2026-03-04', notes: '  ', ratings: [], medications: [] },
];

const report = buildReport(catalog, raw, dateRange('2026-03-01', '2026-03-04'));
const stat = (list, id) => list.find((s) => (s.tracker ?? s.medication).id === id);

describe('buildReport', () => {
  it('treats emptied days as no entry', () => {
    expect(Object.keys(report.days)).toEqual(['2026-03-01', '2026-03-03']);
    expect(report.daysWithEntries).toBe(2);
  });

  it('includes archived items only when they have data in the range', () => {
    expect(report.emotions.map((s) => s.tracker.name)).toEqual(['Sadness', 'Old feeling']);
    expect(report.medications.map((s) => s.medication.name)).toEqual(['Sertraline', 'Never recorded']);
  });

  it('has a point for every date, with gaps as null', () => {
    const s = stat(report.emotions, 1);
    expect(s.points.map((p) => p.value)).toEqual([2, null, 5, null]);
  });

  it('computes averages, highs and acted-on counts from rated days only', () => {
    const s = stat(report.emotions, 1);
    expect(s.daysRated).toBe(2);
    expect(s.average).toBe(3.5);
    expect(s.max).toBe(5);
    const sh = stat(report.urges, 4);
    expect(sh.daysActed).toBe(1);
    expect(sh.average).toBe(2);
  });

  it('sizes the chart axis to the largest scale used in the range', () => {
    expect(stat(report.urges, 5).scaleMax).toBe(10);
    expect(stat(report.urges, 4).scaleMax).toBe(5);
  });

  it('reports medication adherence over recorded days only', () => {
    const s = stat(report.medications, 1);
    expect(s.taken).toEqual([true, null, false, null]);
    expect([s.yes, s.recorded, s.percent]).toEqual([1, 2, 50]);
    const never = stat(report.medications, 2);
    expect([never.recorded, never.percent]).toEqual([0, null]);
  });

  it('handles a range with no data at all', () => {
    const empty = buildReport(catalog, [], dateRange('2026-04-01', '2026-04-03'));
    expect(empty.daysWithEntries).toBe(0);
    const s = stat(empty.emotions, 1);
    expect([s.average, s.max, s.daysRated]).toEqual([null, null, 0]);
  });
});

describe('formatNumber', () => {
  it('formats integers, decimals and missing values', () => {
    expect(formatNumber(3)).toBe('3');
    expect(formatNumber(2.25)).toBe('2.3');
    expect(formatNumber(null)).toBe('–');
  });
});
