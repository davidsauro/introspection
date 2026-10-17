<script setup>
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import { cssVar } from '../utils/charts.js';

// Horizontal bars: % of recorded days each medication was taken.
const props = defineProps({
  stats: { type: Array, required: true }, // buildReport().medications
  print: { type: Boolean, default: false },
});

const data = computed(() => ({
  labels: props.stats.map((s) => s.medication.name),
  datasets: [
    {
      data: props.stats.map((s) => s.percent ?? 0),
      backgroundColor: cssVar('--accent'),
      borderRadius: 6,
      barThickness: 18,
    },
  ],
}));

const options = computed(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  animation: props.print ? false : { duration: 250 },
  devicePixelRatio: props.print ? 3 : undefined,
  plugins: {
    legend: { display: false },
    tooltip: {
      enabled: !props.print,
      callbacks: {
        label: (ctx) => {
          const s = props.stats[ctx.dataIndex];
          return s.recorded ? `${s.percent}% (${s.yes} of ${s.recorded} recorded days)` : 'Not recorded';
        },
      },
    },
  },
  scales: {
    x: {
      min: 0,
      max: 100,
      ticks: { color: cssVar('--muted'), callback: (v) => `${v}%`, font: { size: 10 } },
      grid: { color: cssVar('--border') },
    },
    y: { ticks: { color: cssVar('--text'), font: { size: 12 } }, grid: { display: false } },
  },
}));
</script>

<template>
  <figure class="card med-chart">
    <figcaption>
      <h3>Medication taken</h3>
      <span class="muted small">% of recorded days</span>
    </figcaption>
    <div class="canvas-box" :style="{ height: `${Math.max(80, stats.length * 36 + 30)}px` }">
      <Bar :data="data" :options="options" aria-label="Medication taken, percent of recorded days" role="img" />
    </div>
  </figure>
</template>

<style scoped>
.med-chart {
  margin: 0;
  display: grid;
  gap: 8px;
}

figcaption {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.canvas-box {
  position: relative;
}
</style>
