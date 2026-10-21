<script setup>
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import { cssVar } from '../utils/charts.js';
import { addDays, formatShort } from '../utils/dates.js';
import { formatNumber } from '../utils/report.js';

// Bars: hours slept each night in the range; nights without hours are left as gaps.
// Each bar sits on the date it was entered, which is the morning after that night.
const props = defineProps({
  sleep: { type: Object, required: true }, // buildReport().sleep
  dates: { type: Array, required: true },
});

const hours = computed(() => props.sleep.nights.map((n) => n?.hours ?? null));

const data = computed(() => ({
  labels: props.dates.map(formatShort),
  datasets: [
    {
      data: hours.value,
      backgroundColor: cssVar('--sleep'),
      borderRadius: 4,
      maxBarThickness: 28,
    },
  ],
}));

const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 250 },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: (items) => `Night of ${formatShort(addDays(props.dates[items[0].dataIndex], -1))}`,
        label: (ctx) => `${formatNumber(ctx.raw)} hours`,
      },
    },
  },
  scales: {
    x: {
      ticks: { color: cssVar('--muted'), maxRotation: 0, autoSkipPadding: 12, font: { size: 10 } },
      grid: { display: false },
    },
    y: {
      min: 0,
      // 12 hours fits most nights; a longer one stretches the axis to the next even hour.
      max: Math.max(12, Math.ceil(Math.max(0, ...hours.value) / 2) * 2),
      ticks: { color: cssVar('--muted'), stepSize: 2, font: { size: 10 } },
      grid: { color: cssVar('--border') },
    },
  },
}));
</script>

<template>
  <figure class="card sleep-chart">
    <figcaption>
      <h3>Hours slept <span class="muted small sub">the night before each date</span></h3>
      <span class="muted small">
        <template v-if="sleep.nightsWithHours">avg {{ formatNumber(sleep.average) }} h · {{ sleep.nightsWithHours }} {{ sleep.nightsWithHours === 1 ? 'night' : 'nights' }}</template>
        <template v-else>No hours entered</template>
      </span>
    </figcaption>
    <div class="canvas-box">
      <Bar :data="data" :options="options" aria-label="Hours slept per night" role="img" />
    </div>
  </figure>
</template>

<style scoped>
.sleep-chart {
  margin: 0;
  display: grid;
  gap: 8px;
}

.sub {
  font-weight: 400;
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
  height: 180px;
}
</style>
