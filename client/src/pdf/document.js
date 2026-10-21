// Builds the pdfmake document definition for the therapist PDF. Pure data in, data out
// (no DOM), so it can be unit-tested in Node. Chart images are rendered separately in the
// browser (see charts.js) and passed in as data URLs.
import { addDays, formatLong, formatMedium, formatRange, formatShort, formatWeekday } from '../utils/dates.js';
import { formatNumber, visibleForDay } from '../utils/report.js';
import { MODULES, compareSkills } from '../utils/skills.js';

export const PAGE = { size: 'LETTER', margins: [40, 48, 40, 44] };
// Content width in points: Letter is 612pt wide.
const CONTENT_WIDTH = 612 - PAGE.margins[0] - PAGE.margins[2];
// Chart images are drawn at this size in the PDF (points); charts.js renders to match.
export const CHART_SIZE = { width: CONTENT_WIDTH / 2 - 20, height: 96 };
const HEATMAP_DAYS_PER_TABLE = 16;

// The app's light theme (styles.css), which prints well.
const C = {
  accent: '#4f7c78',
  urge: '#b0664c',
  danger: '#b3412f',
  period: '#c23a3a',
  sleep: '#5a6bb0',
  text: '#23262b',
  muted: '#6b7078',
  border: '#e2dfd8',
  surface2: '#efede8',
  white: '#ffffff',
};

// Blends a colour with white: pct=100 is the colour itself, 0 is white.
export function tint(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift) => Math.round(255 + (((n >> shift) & 255) - 255) * (pct / 100));
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('')}`;
}

const toneOf = (tracker) => (tracker.kind === 'urge' ? C.urge : C.accent);

// ---------- Shared building blocks ----------

const cardLayout = {
  hLineWidth: () => 0.75,
  vLineWidth: () => 0.75,
  hLineColor: () => C.border,
  vLineColor: () => C.border,
  paddingLeft: () => 7,
  paddingRight: () => 7,
  paddingTop: () => 6,
  paddingBottom: () => 6,
};

// Framed table with a rule under the header and light rules between rows, no column lines.
const tableLayout = {
  ...cardLayout,
  hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 0.75 : 0.4),
  vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length ? 0.75 : 0),
};

const card = (content) => ({ table: { widths: ['*'], body: [[content]] }, layout: cardLayout });

const heading = (text, extra = {}) => ({ text, style: 'h2', ...extra });

function answer(value, { yesColor = C.accent } = {}) {
  if (value === true) return { text: 'Yes', bold: true, color: yesColor };
  if (value === false) return { text: 'No', bold: true, color: C.text };
  return { text: '—', color: C.muted };
}

// Lays cards out `perRow` across; each row stays together on one page.
function cardRows(cards, perRow) {
  const rows = [];
  for (let i = 0; i < cards.length; i += perRow) {
    const slice = cards.slice(i, i + perRow);
    while (slice.length < perRow) slice.push({ text: '' });
    rows.push({ columns: slice.map((c) => ({ width: '*', stack: [c] })), columnGap: 8, margin: [0, 0, 0, 8], unbreakable: true });
  }
  return rows;
}

// ---------- One day ----------

// The 0..max boxes, with the chosen value filled in, like the app's rating buttons.
// Scales longer than 0–5 wrap onto two rows.
function scaleBoxes(value, max, tone) {
  const values = Array.from({ length: max + 1 }, (_, i) => i);
  const perRow = max > 5 ? Math.ceil(values.length / 2) : values.length;
  const rows = [];
  for (let i = 0; i < values.length; i += perRow) rows.push(values.slice(i, i + perRow));

  const box = (v) => {
    if (v === undefined) return { text: '' };
    const selected = v === value;
    const below = value !== null && v < value;
    return {
      text: String(v),
      alignment: 'center',
      fontSize: 8,
      bold: selected,
      color: selected ? C.white : C.text,
      fillColor: selected ? tone : below ? tint(tone, 25) : C.surface2,
    };
  };

  return {
    table: {
      widths: Array(perRow).fill('*'),
      body: rows.map((r) => Array.from({ length: perRow }, (_, i) => box(r[i]))),
    },
    layout: {
      hLineWidth: () => 2,
      vLineWidth: () => 2,
      hLineColor: () => C.white,
      vLineColor: () => C.white,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 2.5,
      paddingBottom: () => 1.5,
    },
    margin: [-2, 3, -2, -2],
  };
}

export function trackerCard(tracker, rating, note) {
  // A past entry keeps the scale it was recorded on.
  const max = rating?.scaleMax ?? tracker.scaleMax;
  const stack = [
    {
      columns: [
        { text: tracker.name, bold: true, fontSize: 9 },
        { text: rating ? `${rating.value} / ${max}` : 'Not rated', width: 'auto', fontSize: 8, color: C.muted, margin: [4, 0.5, 0, 0] },
      ],
    },
    scaleBoxes(rating?.value ?? null, max, toneOf(tracker)),
  ];
  if (tracker.trackActed || rating?.actedOn != null) {
    stack.push({
      columns: [
        { text: 'Acted on it?', fontSize: 8 },
        { ...answer(rating?.actedOn ?? null, { yesColor: C.danger }), width: 'auto', fontSize: 8 },
      ],
      margin: [0, 4, 0, 0],
    });
  }
  if (note?.trim()) {
    stack.push({
      table: { widths: ['*'], body: [[{ text: note.trim(), fontSize: 8, lineHeight: 1.2 }]] },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: (i) => (i === 0 ? 1.5 : 0),
        vLineColor: () => tint(toneOf(tracker), 45),
        paddingLeft: () => 5,
        paddingRight: () => 0,
        paddingTop: () => 1,
        paddingBottom: () => 1,
      },
      margin: [0, 5, 0, 0],
    });
  }
  return card({ stack });
}

function medicationsBox(medications, values) {
  if (!medications.length) return card({ text: 'No medications set up.', color: C.muted, fontSize: 8.5 });
  return {
    table: {
      widths: ['*', 'auto'],
      body: medications.map((m) => [
        { stack: [{ text: m.name, bold: true, fontSize: 9 }, ...(m.dose ? [{ text: m.dose, fontSize: 8, color: C.muted }] : [])] },
        { ...answer(values[m.id] ?? null), fontSize: 9, margin: [0, m.dose ? 4 : 0, 0, 0] },
      ]),
    },
    layout: {
      ...cardLayout,
      vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length ? 0.75 : 0),
    },
  };
}

// Skills ticked that day, listed under their module.
function skillsBox(day, catalog) {
  const used = (catalog.skills ?? []).filter((s) => day.skills?.[s.id]).sort(compareSkills);
  if (!used.length) return card({ text: 'No skills recorded.', fontSize: 9, color: C.muted });
  return card({
    stack: MODULES.map((m) => ({ m, names: used.filter((s) => s.module === m.key).map((s) => s.name) }))
      .filter((g) => g.names.length)
      .map((g) => ({
        text: [{ text: `${g.m.label}: `, bold: true }, g.names.join(', ')],
        fontSize: 9,
        margin: [0, 1, 0, 1],
      })),
  });
}

const FLOW_LABELS = { light: 'Light', medium: 'Medium', heavy: 'Heavy' };

// Label/value rows in a card, like the medications box.
function answerRows(rows) {
  return {
    table: { widths: ['*', 'auto'], body: rows.map(([label, value]) => [{ text: label, bold: true, fontSize: 9 }, { ...value, fontSize: 9 }]) },
    layout: {
      ...cardLayout,
      vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length ? 0.75 : 0),
    },
  };
}

function periodBox(period) {
  return answerRows([
    ['Bleeding', period ? { text: 'Yes', bold: true, color: C.period } : { text: 'No', color: C.muted }],
    ...(period ? [['Flow', period.flow ? { text: FLOW_LABELS[period.flow] } : { text: 'Not set', color: C.muted }]] : []),
  ]);
}

function sleepBox(sleep) {
  if (!sleep) return card({ text: 'No sleep recorded.', fontSize: 9, color: C.muted });
  return answerRows([
    ['Hours slept', sleep.hours === null ? { text: '—', color: C.muted } : { text: formatNumber(sleep.hours), bold: true }],
    ['Fell asleep quickly', answer(sleep.fellAsleepQuickly, { yesColor: C.sleep })],
    ['Stayed asleep', answer(sleep.stayedAsleep, { yesColor: C.sleep })],
  ]);
}

// "Sleep  last night · Tue, Oct 20": a day's sleep entry is about the night before it.
const sleepHeading = (date) =>
  heading(['Sleep  ', { text: `last night · ${formatMedium(addDays(date, -1))}`, bold: false, fontSize: 8.5, color: C.muted }]);

function notesBox(notes) {
  const text = notes?.trim();
  return card(text ? { text: notes, fontSize: 9, lineHeight: 1.25 } : { text: 'No notes.', fontSize: 9, color: C.muted });
}

// One day: the same items the Day screen shows, laid out for paper.
export function daySection(date, day, catalog, { pageBreak } = {}) {
  const content = [{ text: formatLong(date), style: 'h1', ...(pageBreak && { pageBreak }) }];
  if (!day) {
    content.push(card({ text: 'No entry recorded for this day.', color: C.muted, alignment: 'center', margin: [0, 16, 0, 16] }));
    return content;
  }

  const visible = visibleForDay(catalog, day);
  for (const [title, trackers] of [
    ['Emotions', visible.emotions],
    ['Urges', visible.urges],
  ]) {
    content.push(heading(title));
    if (trackers.length) {
      content.push(...cardRows(trackers.map((t) => trackerCard(t, day.ratings[t.id], day.trackerNotes?.[t.id])), 3));
    }
    else content.push({ text: `No ${title.toLowerCase()} set up.`, color: C.muted, fontSize: 8.5, margin: [0, 0, 0, 8] });
  }

  content.push({
    columns: [
      { width: '*', stack: [heading('Period'), periodBox(day.period)] },
      { width: '*', stack: [sleepHeading(date), sleepBox(day.sleep)] },
    ],
    columnGap: 12,
    unbreakable: true,
  });
  content.push({
    columns: [
      { width: '*', stack: [heading('Medications'), medicationsBox(visible.medications, day.medications)] },
      { width: '*', stack: [heading('Notes'), notesBox(day.notes)] },
    ],
    columnGap: 12,
  });
  content.push({ stack: [heading('Skills used'), skillsBox(day, catalog)], unbreakable: true });
  return content;
}

// ---------- Multi-day summary ----------

function heatCell(point, kind) {
  if (point.value === null) return { text: '', fillColor: C.surface2 };
  const ratio = point.scaleMax ? point.value / point.scaleMax : 0;
  const pct = point.value === 0 ? 8 : Math.round(18 + ratio * 72);
  const dark = pct > 55;
  const tone = kind === 'urge' ? C.urge : C.accent;
  return {
    text: [String(point.value), ...(point.actedOn ? [{ text: '•', bold: true, color: dark ? C.white : C.danger }] : [])],
    fillColor: tint(tone, pct),
    color: dark ? C.white : C.text,
    bold: true,
    alignment: 'center',
  };
}

function heatmapTable(report, from, to) {
  const start = report.dates.indexOf(from);
  const end = report.dates.indexOf(to);
  const dates = report.dates.slice(start, end + 1);
  const span = dates.length + 1;
  const filler = Array(dates.length).fill({});
  const body = [
    [{ text: '' }, ...dates.map((d) => ({ text: `${formatWeekday(d)}\n${Number(d.slice(8))}`, alignment: 'center', color: C.muted, fontSize: 6.5 }))],
  ];
  const sectionRow = (title) => [{ text: title.toUpperCase(), colSpan: span, fontSize: 6, bold: true, color: C.muted, characterSpacing: 0.6, margin: [0, 3, 0, 0] }, ...filler];

  for (const [title, stats] of [
    ['Emotions', report.emotions],
    ['Urges', report.urges],
  ]) {
    if (!stats.length) continue;
    body.push(sectionRow(title));
    for (const s of stats) {
      body.push([{ text: s.tracker.name, bold: true }, ...s.points.slice(start, end + 1).map((p) => heatCell(p, s.tracker.kind))]);
    }
  }
  body.push(sectionRow('Period'));
  body.push([
    { text: 'Bleeding', bold: true },
    ...report.period.slice(start, end + 1).map((p) => ({ text: '', fillColor: p ? C.period : C.surface2 })),
  ]);

  const nights = report.sleep.nights.slice(start, end + 1);
  body.push(sectionRow('Sleep (the night before)'));
  body.push([
    { text: 'Hours slept', bold: true },
    ...nights.map((n) => ({
      text: n?.hours != null ? formatNumber(n.hours) : '',
      bold: true,
      alignment: 'center',
      fillColor: n?.hours != null ? tint(C.sleep, 22) : C.surface2,
    })),
  ]);
  for (const [key, label] of [
    ['fellAsleepQuickly', 'Fell asleep quickly'],
    ['stayedAsleep', 'Stayed asleep'],
  ]) {
    body.push([
      { text: label, bold: true },
      ...nights.map((n) => ({
        text: !n ? '' : n[key] ? 'Y' : 'N',
        color: n?.[key] ? C.sleep : C.muted,
        bold: true,
        alignment: 'center',
        fillColor: C.surface2,
      })),
    ]);
  }

  if (report.medications.length) {
    body.push(sectionRow('Medications'));
    for (const m of report.medications) {
      body.push([
        { text: m.medication.name, bold: true },
        ...m.taken.slice(start, end + 1).map((t) => ({
          text: t === true ? 'Y' : t === false ? 'N' : '',
          color: t === true ? C.accent : C.muted,
          bold: true,
          alignment: 'center',
          fillColor: C.surface2,
        })),
      ]);
    }
  }

  if (report.skills.length) {
    body.push(sectionRow('Skills used'));
    for (const sk of report.skills) {
      body.push([
        { text: sk.skill.name, bold: true },
        ...sk.used.slice(start, end + 1).map((u) => ({ text: '', fillColor: u ? tint(C.accent, 45) : C.surface2 })),
      ]);
    }
  }

  return {
    table: { headerRows: 1, widths: [84, ...Array(dates.length).fill('*')], body },
    layout: {
      hLineWidth: () => 1.5,
      vLineWidth: () => 1.5,
      hLineColor: () => C.white,
      vLineColor: () => C.white,
      paddingLeft: () => 2,
      paddingRight: () => 2,
      paddingTop: () => 2.5,
      paddingBottom: () => 1.5,
    },
    fontSize: 7.5,
    margin: [0, 0, 0, 8],
  };
}

function chartCard(stat, image) {
  const caption = `avg ${formatNumber(stat.average)} · max ${formatNumber(stat.max)}` +
    (stat.tracker.trackActed || stat.daysActed ? ` · acted ${stat.daysActed}×` : '');
  return card({
    stack: [
      {
        columns: [
          { text: stat.tracker.name, bold: true, fontSize: 9 },
          { text: caption, width: 'auto', fontSize: 7.5, color: C.muted, margin: [4, 1, 0, 0] },
        ],
      },
      image
        ? { image, width: CHART_SIZE.width, height: CHART_SIZE.height, margin: [0, 4, 0, 0] }
        : { text: `Rated on ${stat.daysRated} of ${stat.points.length} days`, fontSize: 8, color: C.muted, margin: [0, 4, 0, 0] },
    ],
  });
}

function urgeTable(urges) {
  const head = ['Urge', 'Days rated', 'Average', 'Highest', 'Days acted on'].map((text, i) => ({
    text,
    fontSize: 7.5,
    bold: true,
    color: C.muted,
    alignment: i ? 'right' : 'left',
  }));
  const rows = urges.map((s) => [
    { text: s.tracker.name, bold: true },
    { text: String(s.daysRated), alignment: 'right' },
    { text: [formatNumber(s.average), { text: ` / ${s.scaleMax}`, color: C.muted }], alignment: 'right' },
    { text: formatNumber(s.max), alignment: 'right' },
    { text: s.tracker.trackActed || s.daysActed ? String(s.daysActed) : '–', alignment: 'right' },
  ]);
  return {
    table: { headerRows: 1, widths: ['*', 60, 60, 50, 70], body: [head, ...rows] },
    layout: tableLayout,
    fontSize: 8.5,
    margin: [0, 0, 0, 8],
  };
}

function medicationTable(meds) {
  const BAR = 150;
  const head = ['Medication', 'Taken', '', ''].map((text) => ({ text, fontSize: 7.5, bold: true, color: C.muted }));
  const rows = meds.map((s) => [
    { text: s.medication.name, bold: true },
    { text: s.recorded ? `${s.yes} of ${s.recorded} recorded days` : 'Not recorded', color: s.recorded ? C.text : C.muted },
    { text: s.percent === null ? '–' : `${s.percent}%`, alignment: 'right', bold: true },
    {
      canvas: [
        { type: 'rect', x: 0, y: 2, w: BAR, h: 7, r: 3, color: C.surface2 },
        ...(s.percent ? [{ type: 'rect', x: 0, y: 2, w: (BAR * s.percent) / 100, h: 7, r: 3, color: C.accent }] : []),
      ],
    },
  ]);
  return {
    table: { headerRows: 1, widths: ['*', 'auto', 30, BAR], body: [head, ...rows] },
    layout: tableLayout,
    fontSize: 8.5,
  };
}

function skillsTable(report) {
  const head = ['Skill', 'Module', 'Days used'].map((text, i) => ({
    text,
    fontSize: 7.5,
    bold: true,
    color: C.muted,
    alignment: i === 2 ? 'right' : 'left',
  }));
  const byUse = [...report.skills].sort((a, b) => b.days - a.days || compareSkills(a.skill, b.skill));
  const rows = byUse.map((s) => [
    { text: s.skill.name, bold: true },
    { text: MODULES.find((m) => m.key === s.skill.module)?.label ?? '', color: C.muted },
    { text: String(s.days), alignment: 'right' },
  ]);
  const total = [
    { text: `${report.skills.length} different skills`, color: C.muted },
    { text: '' },
    { text: `${report.skillTicks} in total`, alignment: 'right', color: C.muted },
  ];
  return {
    table: { headerRows: 1, widths: ['*', 'auto', 60], body: [head, ...rows, total] },
    layout: tableLayout,
    fontSize: 8.5,
  };
}

// The period days in the range, with their flow.
function periodSummary(report) {
  const marked = report.dates.map((date, i) => ({ date, period: report.period[i] })).filter((d) => d.period);
  if (!marked.length) return card({ text: 'No bleeding recorded in this range.', fontSize: 9, color: C.muted });
  const list = marked.map((d) => (d.period.flow ? `${formatShort(d.date)} (${d.period.flow})` : formatShort(d.date)));
  return card({
    stack: [
      { text: `Bleeding on ${marked.length} of ${report.dates.length} days`, bold: true, color: C.period, fontSize: 9 },
      { text: list.join(', '), fontSize: 8.5, margin: [0, 3, 0, 0] },
    ],
  });
}

function sleepChartCard(sleep, image) {
  return card({
    stack: [
      {
        columns: [
          { text: 'Hours slept', bold: true, fontSize: 9 },
          { text: 'the night before each date', width: 'auto', fontSize: 7.5, color: C.muted, margin: [4, 1, 0, 0] },
        ],
      },
      image
        ? { image, width: CHART_SIZE.width, height: CHART_SIZE.height, margin: [0, 4, 0, 0] }
        : {
            text: sleep.nightsWithHours
              ? `Hours entered for ${sleep.nightsWithHours} of ${sleep.nights.length} nights`
              : 'No hours entered in this range.',
            fontSize: 8,
            color: C.muted,
            margin: [0, 4, 0, 0],
          },
    ],
  });
}

function sleepSummaryCard(sleep) {
  const of = (n) => (sleep.nightsRecorded ? { text: `${n} of ${sleep.nightsRecorded} nights` } : { text: '—', color: C.muted });
  return answerRows([
    ['Average hours', sleep.nightsWithHours ? { text: formatNumber(sleep.average), bold: true } : { text: '—', color: C.muted }],
    ['Nights with hours', { text: String(sleep.nightsWithHours) }],
    ['Fell asleep quickly', of(sleep.fellAsleepQuickly)],
    ['Stayed asleep', of(sleep.stayedAsleep)],
  ]);
}

export function summarySection(report, chartImages = {}) {
  const from = report.dates[0];
  const to = report.dates.at(-1);
  const content = [
    { text: 'Summary', style: 'h1' },
    {
      text: `${formatRange(from, to)} · ${report.dates.length} days · ${report.daysWithEntries} with entries`,
      color: C.muted,
      fontSize: 9,
      margin: [0, -4, 0, 6],
    },
    heading('Overview'),
  ];

  for (let i = 0; i < report.dates.length; i += HEATMAP_DAYS_PER_TABLE) {
    const chunk = report.dates.slice(i, i + HEATMAP_DAYS_PER_TABLE);
    content.push(heatmapTable(report, chunk[0], chunk.at(-1)));
  }
  content.push({
    text: [
      'Shading shows how strong each rating was for its scale. ',
      { text: '•', color: C.danger, fontSize: 10 },
      ' = acted on.  Red = bleeding.  Y / N = yes / no (medication taken, sleep boxes).  Shaded skill cells = skill used.',
    ],
    fontSize: 7,
    color: C.muted,
    margin: [0, -2, 0, 4],
  });

  if (report.emotions.length) {
    content.push(heading('Emotions'), ...cardRows(report.emotions.map((s) => chartCard(s, chartImages[s.tracker.id])), 2));
  }
  if (report.urges.length) {
    content.push(heading('Urges'), ...cardRows(report.urges.map((s) => chartCard(s, chartImages[s.tracker.id])), 2));
    content.push({ ...urgeTable(report.urges), unbreakable: true });
  }
  content.push({ stack: [heading('Period'), periodSummary(report)], unbreakable: true });
  content.push(heading('Sleep'), ...cardRows([sleepChartCard(report.sleep, chartImages.sleep), sleepSummaryCard(report.sleep)], 2));
  if (report.medications.length) {
    content.push({ stack: [heading('Medications'), medicationTable(report.medications)], unbreakable: true });
  }
  content.push(heading('Skills used'));
  content.push(
    report.skills.length
      ? skillsTable(report)
      : { text: 'No skills recorded in this range.', fontSize: 9, color: C.muted }
  );
  return content;
}

// ---------- Whole document ----------

/*
 * report:      buildReport() for the range
 * catalog:     the catalog store (emotions, urges, medications)
 * chartImages: trackerId → PNG data URL, and `sleep` → the hours chart (optional; omitted
 *              charts show a text summary)
 */
export function buildPdfDocument({ report, catalog, chartImages = {}, title = 'Diary Card' }) {
  const from = report.dates[0];
  const to = report.dates.at(-1);
  const single = from === to;

  const content = single
    ? daySection(from, report.days[from], catalog)
    : [
        ...summarySection(report, chartImages),
        ...report.dates.flatMap((d) => daySection(d, report.days[d], catalog, { pageBreak: 'before' })),
      ];

  const rangeText = single ? formatLong(from) : `${formatShort(from)} – ${formatLong(to)}`;
  return {
    pageSize: PAGE.size,
    pageMargins: PAGE.margins,
    info: { title: `${title} – ${rangeText}`, creator: 'Diary' },
    header: () => ({
      columns: [
        { text: title, bold: true },
        { text: rangeText, alignment: 'right' },
      ],
      fontSize: 7.5,
      color: C.muted,
      margin: [PAGE.margins[0], 22, PAGE.margins[2], 0],
    }),
    footer: (page, pages) => ({ text: `Page ${page} of ${pages}`, alignment: 'center', fontSize: 7.5, color: C.muted, margin: [0, 16, 0, 0] }),
    content,
    defaultStyle: { font: 'Roboto', fontSize: 9, color: C.text },
    styles: {
      h1: { fontSize: 17, bold: true, margin: [0, 0, 0, 8] },
      h2: { fontSize: 11, bold: true, margin: [0, 6, 0, 5] },
    },
  };
}

export function pdfFileName(from, to) {
  return from === to ? `diary-${from}.pdf` : `diary-${from}_to_${to}.pdf`;
}
