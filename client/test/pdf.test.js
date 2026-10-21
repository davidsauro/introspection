import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { buildPdfDocument, pdfFileName, tint, trackerCard } from '../src/pdf/document.js';
import { buildReport } from '../src/utils/report.js';
import { dateRange } from '../src/utils/dates.js';

// pdfmake's Node build, with the same Roboto font the browser build embeds.
const require = createRequire(import.meta.url);
const pdfmake = require('pdfmake');
const fontDir = path.join(path.dirname(require.resolve('pdfmake/package.json')), 'build/fonts/Roboto');
pdfmake.addFonts({
  Roboto: {
    normal: path.join(fontDir, 'Roboto-Regular.ttf'),
    bold: path.join(fontDir, 'Roboto-Medium.ttf'),
    italics: path.join(fontDir, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontDir, 'Roboto-MediumItalic.ttf'),
  },
});
pdfmake.setLocalAccessPolicy((p) => p.startsWith(fontDir));
pdfmake.setUrlAccessPolicy(() => false);

async function render(doc) {
  const buffer = await pdfmake.createPdf(doc).getBuffer();
  const pages = buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
  return { buffer, pages };
}

// Every piece of text in a document definition, for checking what the PDF will say.
function texts(node, out = []) {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => texts(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) if (!['layout', 'image', 'canvas'].includes(k)) texts(v, out);
  }
  return out;
}

const trackers = [
  { id: 1, kind: 'emotion', name: 'Sadness', scaleMax: 5, trackActed: false, archived: false },
  { id: 2, kind: 'emotion', name: 'Joy', scaleMax: 5, trackActed: false, archived: false },
  { id: 3, kind: 'emotion', name: 'Retired feeling', scaleMax: 5, trackActed: false, archived: true },
  { id: 4, kind: 'urge', name: 'Self-harm', scaleMax: 5, trackActed: true, archived: false },
  { id: 5, kind: 'urge', name: 'Skip meals', scaleMax: 5, trackActed: true, archived: false },
];
const catalog = {
  emotions: trackers.filter((t) => t.kind === 'emotion'),
  urges: trackers.filter((t) => t.kind === 'urge'),
  skills: [
    { id: 1, module: 'mindfulness', name: 'Wise Mind', sortOrder: 0, archived: false },
    { id: 2, module: 'mindfulness', name: 'Observe', sortOrder: 1, archived: false },
    { id: 3, module: 'distress', name: 'TIPP', sortOrder: 0, archived: false },
    { id: 4, module: 'interpersonal', name: 'GIVE', sortOrder: 0, archived: false },
  ],
  medications: [
    { id: 1, name: 'Sertraline', dose: '50mg', archived: false },
    { id: 2, name: 'Old med', dose: '', archived: true },
  ],
};

const raw = [
  {
    date: '2026-03-02',
    notes: 'Hard morning.\nWalk helped.',
    ratings: [
      { trackerId: 1, value: 4, scaleMax: 5, actedOn: null },
      { trackerId: 3, value: 2, scaleMax: 5, actedOn: null },
      { trackerId: 4, value: 3, scaleMax: 5, actedOn: true },
      { trackerId: 5, value: 8, scaleMax: 10, actedOn: false }, // recorded before the scale was lowered
    ],
    medications: [{ medicationId: 1, taken: true }],
    skills: [3, 1, 2],
    trackerNotes: [
      { trackerId: 1, note: '  Missed Mum.\nCried after lunch.  ' },
      { trackerId: 2, note: '   ' },
    ],
    period: { flow: 'heavy' },
    sleep: { hours: 7.5, fellAsleepQuickly: false, stayedAsleep: true },
  },
  { date: '2026-03-04', notes: '', ratings: [{ trackerId: 2, value: 5, scaleMax: 5, actedOn: null }], medications: [] },
];

const reportFor = (from, to) => buildReport(catalog, raw, dateRange(from, to));

describe('single-day PDF', () => {
  const doc = buildPdfDocument({ report: reportFor('2026-03-02', '2026-03-02'), catalog });
  const words = texts(doc.content);

  it('shows the same items as the day screen, including archived items with data', () => {
    for (const name of ['Sadness', 'Joy', 'Retired feeling', 'Self-harm', 'Skip meals', 'Sertraline', '50mg']) {
      expect(words).toContain(name);
    }
    expect(words).not.toContain('Old med'); // archived, nothing recorded that day
  });

  it('shows ratings on the scale they were recorded on, and unrated items', () => {
    expect(words).toContain('4 / 5');
    expect(words).toContain('8 / 10');
    expect(words).toContain('Not rated'); // Joy
    expect(words).toContain('10'); // the 0–10 boxes for Skip meals
  });

  it('shows each card\'s note under it, trimmed, and skips blank notes', () => {
    expect(words).toContain('Missed Mum.\nCried after lunch.');
    expect(words.filter((w) => !w.trim())).toEqual(words.filter((w) => w === '')); // no whitespace-only text
  });

  it('includes notes, acted-on and medication answers', () => {
    expect(words).toContain('Hard morning.\nWalk helped.');
    expect(words.filter((w) => w === 'Acted on it?')).toHaveLength(2);
    expect(words).toContain('Yes');
    expect(words).toContain('No');
  });

  it('lists the skills used, grouped by module', () => {
    const lines = doc.content.flatMap((n) => n.stack ?? []).flatMap((n) => n.table?.body?.[0]?.[0]?.stack ?? []);
    const text = lines.map((l) => texts(l).join(''));
    expect(text).toEqual(['Mindfulness: Wise Mind, Observe', 'Distress Tolerance: TIPP']);
  });

  it('shows period and last night\'s sleep', () => {
    for (const w of ['Period', 'Bleeding', 'Heavy', 'Hours slept', '7.5', 'Fell asleep quickly', 'Stayed asleep']) {
      expect(words).toContain(w);
    }
    expect(words.some((w) => /^last night · .*Mar.* 1/.test(w))).toBe(true);
  });

  it('renders to a one-page PDF', async () => {
    const { buffer, pages } = await render(doc);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pages).toBe(1);
  });
});

describe('day with no entry', () => {
  it('says so instead of showing an empty card', () => {
    const doc = buildPdfDocument({ report: reportFor('2026-03-03', '2026-03-03'), catalog });
    const words = texts(doc.content);
    expect(words).toContain('No entry recorded for this day.');
    expect(words).not.toContain('Sadness');
  });

  it('shows "No" for bleeding and no sleep on a day with other entries only', () => {
    const doc = buildPdfDocument({ report: reportFor('2026-03-04', '2026-03-04'), catalog });
    const words = texts(doc.content);
    expect(words).toContain('Bleeding');
    expect(words).toContain('No sleep recorded.');
  });
});

describe('multi-day PDF', () => {
  const report = reportFor('2026-03-01', '2026-03-07');
  const doc = buildPdfDocument({ report, catalog });
  const words = texts(doc.content);

  it('starts with a summary, then one page per day', () => {
    expect(words[0]).toBe('Summary');
    expect(words.some((w) => /7 days · 2 with entries/.test(w))).toBe(true);
    const dayHeadings = doc.content.filter((n) => n.style === 'h1' && n.pageBreak === 'before');
    expect(dayHeadings).toHaveLength(7);
    expect(words.filter((w) => w === 'No entry recorded for this day.')).toHaveLength(5);
  });

  it('summarises skills used across the range', () => {
    expect(words).toContain('Skills used');
    expect(words).toContain('3 different skills');
    expect(words).toContain('3 in total');
  });

  it('summarises urges and medications', () => {
    expect(words).toContain('Days acted on');
    expect(words).toContain('1 of 1 recorded days'); // Sertraline
    expect(words).toContain('100%');
  });

  it('falls back to a text summary when chart images are missing', () => {
    expect(words).toContain('Rated on 1 of 7 days');
    expect(words).toContain('Hours entered for 1 of 7 nights');
  });

  it('summarises period days and sleep', () => {
    expect(words).toContain('Bleeding on 1 of 7 days');
    expect(words.some((w) => /Mar.* 2 \(heavy\)/.test(w))).toBe(true);
    expect(words).toContain('Sleep (the night before)'.toUpperCase());
    expect(words).toContain('Average hours');
    expect(words).toContain('0 of 1 nights'); // fell asleep quickly
    expect(words).toContain('1 of 1 nights'); // stayed asleep
  });

  it('splits a long range into several heatmap tables', () => {
    const long = buildPdfDocument({ report: reportFor('2026-03-01', '2026-03-31'), catalog });
    const heatmaps = long.content.filter((n) => n.table?.headerRows === 1 && n.table.widths[0] === 84);
    expect(heatmaps).toHaveLength(2); // 16 + 15 days
  });

  it('renders: summary pages plus one page per day', async () => {
    const { pages } = await render(doc);
    expect(pages).toBeGreaterThanOrEqual(8);
    expect(pages).toBeLessThanOrEqual(10);
  });

  it('renders a 92-day report (the maximum) without trouble', async () => {
    const big = buildPdfDocument({ report: reportFor('2026-01-01', '2026-04-02'), catalog });
    const { pages } = await render(big);
    expect(pages).toBeGreaterThan(92);
  }, 30000);

  it('embeds chart images when given', async () => {
    // 1×1 transparent PNG
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const withCharts = buildPdfDocument({ report, catalog, chartImages: { 1: png, 4: png, sleep: png } });
    expect(JSON.stringify(withCharts.content)).toContain(png);
    const { pages } = await render(withCharts);
    expect(pages).toBeGreaterThanOrEqual(8);
  });
});

describe('helpers', () => {
  it('tints colours toward white', () => {
    expect(tint('#4f7c78', 100)).toBe('#4f7c78');
    expect(tint('#4f7c78', 0)).toBe('#ffffff');
    expect(tint('#000000', 50)).toBe('#808080');
  });

  it('names files by date range', () => {
    expect(pdfFileName('2026-03-02', '2026-03-02')).toBe('diary-2026-03-02.pdf');
    expect(pdfFileName('2026-03-01', '2026-03-07')).toBe('diary-2026-03-01_to_2026-03-07.pdf');
  });

  it('only asks "acted on it?" where the app does', () => {
    const emotionCard = texts(trackerCard(trackers[0], { value: 1, scaleMax: 5, actedOn: null }));
    expect(emotionCard).not.toContain('Acted on it?');
    // A past answer is still shown even if the question has since been turned off.
    const past = texts(trackerCard({ ...trackers[3], trackActed: false }, { value: 1, scaleMax: 5, actedOn: true }));
    expect(past).toContain('Acted on it?');
  });
});
