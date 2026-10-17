<script setup>
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import { trendChartConfig, themeColors } from '../utils/charts.js';
import { formatNumber } from '../utils/report.js';

// Small line chart of one emotion or urge over a date range.
const props = defineProps({
  stat: { type: Object, required: true }, // one entry from buildReport().emotions / .urges
});

const config = computed(() => trendChartConfig(props.stat, themeColors()));
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
      <Line :data="config.data" :options="config.options" :aria-label="`${stat.tracker.name} over time`" role="img" />
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
