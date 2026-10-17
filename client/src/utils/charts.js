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
import { formatShort } from './dates.js';

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
