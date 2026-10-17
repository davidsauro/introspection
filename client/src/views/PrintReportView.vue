<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api.js';
import { useCatalogStore } from '../stores/catalog.js';
import { dateRange, formatLong, formatRange, isValidDate } from '../utils/dates.js';
import { buildReport } from '../utils/report.js';
import DaySheet from '../components/DaySheet.vue';
import HistoryGrid from '../components/HistoryGrid.vue';
import SummaryCharts from '../components/SummaryCharts.vue';

// Rendered by headless Chromium on the server to produce the PDF (see server/src/routes/export.js).
// Sets window.__REPORT_READY__ once everything, charts included, has drawn.
const GRID_CHUNK = 16; // days per heatmap block, so each fits the page width

const route = useRoute();
const catalog = useCatalogStore();
const report = ref(null);

const from = route.query.from;
const to = route.query.to ?? from;
const single = from === to;

const gridChunks = computed(() => {
  if (!report.value) return [];
  const out = [];
  for (let i = 0; i < report.value.dates.length; i += GRID_CHUNK) out.push(report.value.dates.slice(i, i + GRID_CHUNK));
  return out;
});

onMounted(async () => {
  document.documentElement.classList.add('force-light');
  try {
    if (!isValidDate(from) || !isValidDate(to) || from > to) throw new Error('Invalid date range');
    await catalog.load();
    const raw = await api.get(`/days?from=${from}&to=${to}`);
    report.value = buildReport(catalog, raw, dateRange(from, to));
    document.title = `Diary ${formatRange(from, to)}`;
    await nextTick();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    window.__REPORT_READY__ = true;
  } catch (e) {
    window.__REPORT_ERROR__ = e.message || 'Unknown error';
  }
});
</script>

<template>
  <div v-if="report" class="report">
    <template v-if="single">
      <header class="report-head">
        <h1>{{ formatLong(from) }}</h1>
      </header>
      <DaySheet v-if="report.days[from]" :day="report.days[from]" readonly />
      <p v-else class="card muted no-entry">No entry recorded for this day.</p>
    </template>

    <template v-else>
      <header class="report-head">
        <h1>Summary</h1>
        <p class="muted">
          {{ formatRange(from, to) }} · {{ report.dates.length }} days · {{ report.daysWithEntries }} with entries
        </p>
      </header>

      <section class="block">
        <h2 class="section-title">Overview</h2>
        <div class="grids">
          <HistoryGrid v-for="(chunk, i) in gridChunks" :key="i" :report="report" :dates="chunk" print />
        </div>
      </section>

      <SummaryCharts :report="report" print />

      <section v-for="date in report.dates" :key="date" class="day-page">
        <header class="report-head">
          <h1>{{ formatLong(date) }}</h1>
        </header>
        <DaySheet v-if="report.days[date]" :day="report.days[date]" readonly />
        <p v-else class="card muted no-entry">No entry recorded.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.report {
  max-width: 100%;
  padding: 0;
  background: #fff;
}

.report-head {
  margin-bottom: 14px;
}

.report-head p {
  margin: 4px 0 0;
}

.block {
  margin-bottom: 24px;
  break-inside: avoid;
}

.grids {
  display: grid;
  gap: 10px;
}

.day-page {
  break-before: page;
}

.no-entry {
  text-align: center;
  padding: 32px;
}
</style>

<style>
/* Tighter, print-friendly sizing for the whole report. */
html.force-light {
  --tap: 28px;
}
html.force-light body {
  background: #fff;
  font-size: 13px;
}
html.force-light .card {
  padding: 10px 12px;
  box-shadow: none;
}
html.force-light .card h3 {
  font-size: 0.9rem;
}

/* Compact day sheet so each day fits on one page. */
html.force-light .sheet {
  gap: 14px;
}
html.force-light .sheet .pane {
  gap: 14px;
}
html.force-light .sheet .grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
html.force-light .sheet .side {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}
html.force-light .tracker {
  gap: 6px;
  padding: 8px 10px;
}
html.force-light .segmented button {
  min-width: 40px;
  font-size: 0.8rem;
}
html.force-light .section-title {
  margin-bottom: 6px;
}
</style>
