<script setup>
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import { cssVar } from '../utils/charts.js';
import { formatShort } from '../utils/dates.js';
import { formatNumber } from '../utils/report.js';

// Small line chart of one emotion or urge over a date range.
const props = defineProps({
  stat: { type: Object, required: true }, // one entry from buildReport().emotions / .urges
  print: { type: Boolean, default: false },
});

const isUrge = computed(() => props.stat.tracker.kind === 'urge');

const data = computed(() => {
  const color = cssVar(isUrge.value ? '--urge' : '--accent');
  const acted = props.stat.points.map((p) => p.actedOn === true);
  return {
    labels: props.stat.points.map((p) => formatShort(p.date)),
    datasets: [
      {
        data: props.stat.points.map((p) => p.value),
        borderColor: color,
        backgroundColor: `${color}22`,
        fill: true,
        cubicInterpolationMode: 'monotone', // smooth without overshooting the real values
        spanGaps: false,
        borderWidth: 2,
        // Days she acted on an urge get a larger diamond marker.
        pointStyle: acted.map((a) => (a ? 'rectRot' : 'circle')),
        pointRadius: acted.map((a) => (a ? 6 : 3)),
        pointBackgroundColor: acted.map((a) => (a ? cssVar('--danger') : color)),
        pointBorderColor: acted.map((a) => (a ? cssVar('--danger') : color)),
      },
    ],
  };
});

const options = computed(() => {
  const text = cssVar('--muted');
  const grid = cssVar('--border');
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: props.print ? false : { duration: 250 },
    devicePixelRatio: props.print ? 3 : undefined,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: !props.print,
        callbacks: {
          label: (ctx) => {
            const p = props.stat.points[ctx.dataIndex];
            return `${p.value} / ${p.scaleMax}${p.actedOn ? ' · acted on' : ''}`;
          },
        },
      },
    },
    scales: {
      x: { ticks: { color: text, maxRotation: 0, autoSkipPadding: 12, font: { size: 10 } }, grid: { display: false } },
      y: {
        min: 0,
        max: props.stat.scaleMax,
        ticks: { color: text, stepSize: props.stat.scaleMax > 5 ? 2 : 1, font: { size: 10 } },
        grid: { color: grid },
      },
    },
  };
});
</script>

<template>
  <figure class="card trend">
    <figcaption>
      <h3>{{ stat.tracker.name }}</h3>
      <span class="muted small">
        avg {{ formatNumber(stat.average) }} · max {{ formatNumber(stat.max) }}
        <template v-if="stat.tracker.trackActed || stat.daysActed"> · acted {{ stat.daysActed }}×</template>
      </span>
    </figcaption>
    <div class="canvas-box">
      <Line :data="data" :options="options" :aria-label="`${stat.tracker.name} over time`" role="img" />
    </div>
  </figure>
</template>

<style scoped>
.trend {
  margin: 0;
  display: grid;
  gap: 8px;
  min-width: 0;
}

figcaption {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.canvas-box {
  position: relative;
  height: 150px;
}
</style>
