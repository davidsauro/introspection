<script setup>
import TrendChart from './TrendChart.vue';
import MedicationChart from './MedicationChart.vue';
import { formatNumber } from '../utils/report.js';

defineProps({
  report: { type: Object, required: true },
  print: { type: Boolean, default: false },
});
</script>

<template>
  <div class="summary" :class="{ print }">
    <section v-if="report.emotions.length">
      <h2 class="section-title">Emotions</h2>
      <div class="charts">
        <TrendChart v-for="s in report.emotions" :key="s.tracker.id" :stat="s" :print="print" />
      </div>
    </section>

    <section v-if="report.urges.length">
      <h2 class="section-title">
        Urges
        <span class="legend muted small"><span class="diamond" /> acted on</span>
      </h2>
      <div class="charts">
        <TrendChart v-for="s in report.urges" :key="s.tracker.id" :stat="s" :print="print" />
      </div>

      <div class="card table-card">
        <table class="stats">
          <thead>
            <tr>
              <th scope="col">Urge</th>
              <th scope="col">Days rated</th>
              <th scope="col">Average</th>
              <th scope="col">Highest</th>
              <th scope="col">Days acted on</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in report.urges" :key="s.tracker.id">
              <th scope="row">{{ s.tracker.name }}</th>
              <td>{{ s.daysRated }}</td>
              <td>{{ formatNumber(s.average) }}<span class="muted"> / {{ s.scaleMax }}</span></td>
              <td>{{ formatNumber(s.max) }}</td>
              <td>{{ s.tracker.trackActed || s.daysActed ? s.daysActed : '–' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="report.medications.length">
      <h2 class="section-title">Medications</h2>
      <MedicationChart :stats="report.medications" :print="print" />
    </section>
  </div>
</template>

<style scoped>
.summary {
  display: grid;
  gap: 28px;
}

section {
  display: grid;
  gap: 12px;
}

.section-title {
  margin: 0;
}

.charts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 12px;
}

.legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 400;
}

.diamond {
  width: 8px;
  height: 8px;
  transform: rotate(45deg);
  background: var(--danger);
}

.table-card {
  overflow-x: auto;
  padding: 6px 12px;
}

.stats {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.stats th,
.stats td {
  padding: 8px 6px;
  text-align: right;
  white-space: nowrap;
}

.stats th:first-child {
  text-align: left;
  font-weight: 550;
}

.stats thead th {
  color: var(--muted);
  font-weight: 550;
  font-size: 0.8rem;
}

.stats tbody tr + tr {
  border-top: 1px solid var(--border);
}

/* In the PDF: two charts per row. Flexbox rather than grid, because Chrome can overlap
   grid items that are split across a page break. */
.print .charts {
  display: flex;
  flex-wrap: wrap;
}
.print .charts > * {
  flex: 0 0 calc(50% - 6px);
}
.print section {
  display: block;
}
.print section > * + * {
  margin-top: 12px;
}
</style>
