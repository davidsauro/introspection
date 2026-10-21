<script setup>
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import { sleepChartConfig, themeColors } from '../utils/charts.js';
import { formatNumber } from '../utils/report.js';

// Bars: hours slept each night in the range (see sleepChartConfig).
const props = defineProps({
  sleep: { type: Object, required: true }, // buildReport().sleep
  dates: { type: Array, required: true },
});

const config = computed(() => sleepChartConfig(props.sleep, props.dates, themeColors()));
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
      <Bar :data="config.data" :options="config.options" aria-label="Hours slept per night" role="img" />
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
