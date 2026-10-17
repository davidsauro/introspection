<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { useCatalogStore } from '../stores/catalog.js';
import { addDays, dateRange, formatRange, today, isValidDate } from '../utils/dates.js';
import { buildReport } from '../utils/report.js';
import HistoryGrid from '../components/HistoryGrid.vue';
import SummaryCharts from '../components/SummaryCharts.vue';
import AppIcon from '../components/AppIcon.vue';

const PERIODS = [7, 14, 30];

const route = useRoute();
const router = useRouter();
const catalog = useCatalogStore();

// Range lives in the URL (?days=14&end=2026-10-16) so back/forward and reloads keep it.
// Default to what fits: a month on a laptop / landscape iPad, two weeks on smaller screens.
const defaultPeriod = window.innerWidth >= 1024 ? 30 : 14;
const period = computed(() => (PERIODS.includes(Number(route.query.days)) ? Number(route.query.days) : defaultPeriod));
const end = computed(() => (isValidDate(route.query.end) && route.query.end <= today() ? route.query.end : today()));
const start = computed(() => addDays(end.value, -(period.value - 1)));

const report = ref(null);
const error = ref('');
const loading = ref(false);

function setRange(days, endDate) {
  const query = { days: String(days) };
  if (endDate < today()) query.end = endDate;
  router.replace({ query });
}

const shift = (dir) => setRange(period.value, addDays(end.value, dir * period.value));
const atToday = computed(() => end.value >= today());

watch(
  [start, end],
  async ([from, to]) => {
    loading.value = true;
    error.value = '';
    try {
      await catalog.load();
      const raw = await api.get(`/days?from=${from}&to=${to}`);
      report.value = buildReport(catalog, raw, dateRange(from, to));
    } catch (e) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="history">
    <header class="page-header">
      <h1>History</h1>
      <span class="spacer" />
      <div class="segmented period" role="radiogroup" aria-label="Range">
        <button
          v-for="p in PERIODS"
          :key="p"
          type="button"
          role="radio"
          class="yes"
          :aria-checked="p === period"
          @click="setRange(p, end)"
        >
          {{ p }} days
        </button>
      </div>
    </header>

    <div class="range-bar">
      <button class="btn icon ghost" type="button" aria-label="Earlier" @click="shift(-1)"><AppIcon name="left" /></button>
      <strong class="range-label">{{ formatRange(start, end) }}</strong>
      <button class="btn icon ghost" type="button" aria-label="Later" :disabled="atToday" @click="shift(1)">
        <AppIcon name="right" />
      </button>
      <span class="spacer" />
      <RouterLink class="btn" :to="{ name: 'export', query: { from: start, to: end } }">
        <AppIcon name="share" :size="18" /> Export PDF
      </RouterLink>
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>

    <template v-if="report">
      <p v-if="!report.daysWithEntries" class="muted">No entries in this range yet.</p>
      <section class="block">
        <p class="muted small hint">Tap a date to open that day.</p>
        <HistoryGrid :report="report" />
      </section>
      <SummaryCharts class="block" :report="report" />
    </template>
  </div>
</template>

<style scoped>
.range-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.range-label {
  font-variant-numeric: tabular-nums;
}

.period button {
  min-width: 0;
  padding: 0 12px;
}

.block {
  margin-bottom: 28px;
}

.hint {
  margin: 0 0 8px;
}
</style>
