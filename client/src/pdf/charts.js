import { Chart, trendChartConfig, sleepChartConfig } from '../utils/charts.js';
import { CHART_SIZE } from './document.js';

// Light-theme colours so charts print the same whatever theme the device is in.
const PRINT_COLORS = {
  accent: '#4f7c78',
  urge: '#b0664c',
  danger: '#b3412f',
  muted: '#6b7078',
  grid: '#e2dfd8',
  sleep: '#5a6bb0',
};

// Draw at 1.5 CSS px per PDF point, then 3× pixel density, so text and lines stay crisp.
const CSS_PER_POINT = 1.5;
const PIXEL_RATIO = 3;

function renderImage(config) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(CHART_SIZE.width * CSS_PER_POINT);
  canvas.height = Math.round(CHART_SIZE.height * CSS_PER_POINT);
  config.options.devicePixelRatio = PIXEL_RATIO;
  const chart = new Chart(canvas, config);
  const image = chart.toBase64Image('image/png');
  chart.destroy();
  return image;
}

// Renders each emotion/urge trend chart off-screen and returns trackerId → PNG data URL,
// plus `sleep` → the hours-slept chart when any hours were entered.
export function renderChartImages(report) {
  const images = {};
  for (const stat of [...report.emotions, ...report.urges]) {
    images[stat.tracker.id] = renderImage(trendChartConfig(stat, PRINT_COLORS, { still: true }));
  }
  if (report.sleep.nightsWithHours) {
    images.sleep = renderImage(sleepChartConfig(report.sleep, report.dates, PRINT_COLORS, { still: true }));
  }
  return images;
}
