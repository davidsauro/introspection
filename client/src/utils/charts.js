import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from 'chart.js';
import { addDays, formatShort } from './dates.js';
import { formatNumber } from './report.js';

Chart.register(LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale, Tooltip, Filler);

export { Chart };

// Reads a colour token from styles.css so charts follow light/dark mode.
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// The current theme's chart colours.
export function themeColors() {
  return {
    accent: cssVar('--accent'),
    urge: cssVar('--urge'),
    danger: cssVar('--danger'),
    text: cssVar('--text'),
    muted: cssVar('--muted'),
    grid: cssVar('--border'),
    sleep: cssVar('--sleep'),
  };
}

/*
 * Line chart of one emotion or urge over a date range. Shared by the History screen and the
 * PDF (which renders it off-screen to an image).
 *   stat:   one entry from buildReport().emotions / .urges
 *   colors: { accent, urge, danger, muted, grid } as #rrggbb
 *   still:  true for a static image (no animation or tooltips)
 */
export function trendChartConfig(stat, colors, { still = false } = {}) {
  const color = stat.tracker.kind === 'urge' ? colors.urge : colors.accent;
  const acted = stat.points.map((p) => p.actedOn === true);
  return {
    type: 'line',
    data: {
      labels: stat.points.map((p) => formatShort(p.date)),
      datasets: [
        {
          data: stat.points.map((p) => p.value),
          borderColor: color,
          backgroundColor: `${color}22`,
          fill: true,
          cubicInterpolationMode: 'monotone', // smooth without overshooting the real values
          spanGaps: false,
          borderWidth: 2,
          // Days she acted on an urge get a larger diamond marker.
          pointStyle: acted.map((a) => (a ? 'rectRot' : 'circle')),
          pointRadius: acted.map((a) => (a ? 6 : 3)),
          pointBackgroundColor: acted.map((a) => (a ? colors.danger : color)),
          pointBorderColor: acted.map((a) => (a ? colors.danger : color)),
        },
      ],
    },
    options: {
      responsive: !still,
      maintainAspectRatio: false,
      animation: still ? false : { duration: 250 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: !still,
          callbacks: {
            label: (ctx) => {
              const p = stat.points[ctx.dataIndex];
              return `${p.value} / ${p.scaleMax}${p.actedOn ? ' · acted on' : ''}`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { color: colors.muted, maxRotation: 0, autoSkipPadding: 12, font: { size: still ? 11 : 10 } }, grid: { display: false } },
        y: {
          min: 0,
          max: stat.scaleMax,
          ticks: { color: colors.muted, stepSize: stat.scaleMax > 5 ? 2 : 1, font: { size: still ? 11 : 10 } },
          grid: { color: colors.grid },
        },
      },
    },
  };
}

/*
 * Bars of hours slept per night, with gaps where no hours were entered. Each bar sits on the
 * date it was entered, which is the morning after that night. Shared by History and the PDF.
 *   sleep:  buildReport().sleep;  dates: the report's dates
 *   colors: { sleep, muted, grid } as #rrggbb;  still: as for trendChartConfig
 */
export function sleepChartConfig(sleep, dates, colors, { still = false } = {}) {
  const hours = sleep.nights.map((n) => n?.hours ?? null);
  return {
    type: 'bar',
    data: {
      labels: dates.map(formatShort),
      datasets: [{ data: hours, backgroundColor: colors.sleep, borderRadius: 4, maxBarThickness: 28 }],
    },
    options: {
      responsive: !still,
      maintainAspectRatio: false,
      animation: still ? false : { duration: 250 },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: !still,
          callbacks: {
            title: (items) => `Night of ${formatShort(addDays(dates[items[0].dataIndex], -1))}`,
            label: (ctx) => `${formatNumber(ctx.raw)} hours`,
          },
        },
      },
      scales: {
        x: { ticks: { color: colors.muted, maxRotation: 0, autoSkipPadding: 12, font: { size: still ? 11 : 10 } }, grid: { display: false } },
        y: {
          min: 0,
          // 12 hours fits most nights; a longer one stretches the axis to the next even hour.
          max: Math.max(12, Math.ceil(Math.max(0, ...hours) / 2) * 2),
          ticks: { color: colors.muted, stepSize: still ? 4 : 2, font: { size: still ? 11 : 10 } },
          grid: { color: colors.grid },
        },
      },
    },
  };
}
