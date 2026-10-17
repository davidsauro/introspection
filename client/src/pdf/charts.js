import { Chart, trendChartConfig } from '../utils/charts.js';
import { CHART_SIZE } from './document.js';

// Light-theme colours so charts print the same whatever theme the device is in.
const PRINT_COLORS = {
  accent: '#4f7c78',
  urge: '#b0664c',
  danger: '#b3412f',
  muted: '#6b7078',
  grid: '#e2dfd8',
};

// Draw at 1.5 CSS px per PDF point, then 3× pixel density, so text and lines stay crisp.
const CSS_PER_POINT = 1.5;
const PIXEL_RATIO = 3;

// Renders each emotion/urge trend chart off-screen and returns trackerId → PNG data URL.
export function renderChartImages(report) {
  const images = {};
  for (const stat of [...report.emotions, ...report.urges]) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(CHART_SIZE.width * CSS_PER_POINT);
    canvas.height = Math.round(CHART_SIZE.height * CSS_PER_POINT);
    const config = trendChartConfig(stat, PRINT_COLORS, { still: true });
    config.options.devicePixelRatio = PIXEL_RATIO;
    const chart = new Chart(canvas, config);
    images[stat.tracker.id] = chart.toBase64Image('image/png');
    chart.destroy();
  }
  return images;
}
