<script setup>
import { formatWeekday } from '../utils/dates.js';

// Tracker × date heatmap with a medication row per medication.
defineProps({
  report: { type: Object, required: true }, // from buildReport()
});

function cellStyle(point, kind) {
  if (point.value === null) return {};
  const ratio = point.scaleMax ? point.value / point.scaleMax : 0;
  const pct = point.value === 0 ? 8 : Math.round(18 + ratio * 72);
  const tone = kind === 'urge' ? 'var(--urge)' : 'var(--accent)';
  return {
    background: `color-mix(in srgb, ${tone} ${pct}%, var(--surface))`,
    color: pct > 55 ? (kind === 'urge' ? 'var(--urge-contrast)' : 'var(--accent-contrast)') : 'var(--text)',
  };
}

const dayNum = (d) => Number(d.slice(8));
</script>

<template>
  <div class="grid-scroll">
    <table class="heat">
      <thead>
        <tr>
          <th class="name" scope="col"><span class="sr-only">Item</span></th>
          <th v-for="d in report.dates" :key="d" scope="col" class="date">
            <RouterLink :to="`/day/${d}`" class="date-link">
              <span class="wd">{{ formatWeekday(d) }}</span>
              <span class="dn">{{ dayNum(d) }}</span>
            </RouterLink>
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="section in [
          { title: 'Emotions', stats: report.emotions },
          { title: 'Urges', stats: report.urges },
        ]" :key="section.title">
          <tr v-if="section.stats.length" class="section">
            <th :colspan="report.dates.length + 1" scope="colgroup">{{ section.title }}</th>
          </tr>
          <tr v-for="s in section.stats" :key="s.tracker.id">
            <th class="name" scope="row">{{ s.tracker.name }}</th>
            <td v-for="p in s.points" :key="p.date" :style="cellStyle(p, s.tracker.kind)" class="cell">
              <template v-if="p.value !== null">{{ p.value }}</template>
              <span v-if="p.actedOn" class="acted" title="Acted on" aria-label="acted on" />
            </td>
          </tr>
        </template>

        <template v-if="report.medications.length">
          <tr class="section">
            <th :colspan="report.dates.length + 1" scope="colgroup">Medications</th>
          </tr>
          <tr v-for="m in report.medications" :key="m.medication.id">
            <th class="name" scope="row">{{ m.medication.name }}</th>
            <td v-for="(taken, i) in m.taken" :key="i" class="cell med" :class="{ yes: taken === true, no: taken === false }">
              {{ taken === true ? '✓' : taken === false ? '✗' : '' }}
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.grid-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.heat {
  border-collapse: separate;
  border-spacing: 2px;
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
  min-width: 100%;
}

th,
td {
  padding: 0;
}

.name {
  position: sticky;
  left: 0;
  z-index: 1;
  background: var(--surface);
  text-align: left;
  font-weight: 550;
  padding: 0 10px 0 8px;
  white-space: nowrap;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.date {
  min-width: 30px;
}

.date-link {
  display: grid;
  justify-items: center;
  padding: 6px 0 4px;
  border-radius: 8px;
  color: var(--muted);
  text-decoration: none;
  font-weight: 500;
}

.date-link .dn {
  color: var(--text);
  font-weight: 600;
}

@media (hover: hover) {
  a.date-link:hover {
    background: var(--surface-2);
  }
}

.section th {
  position: sticky;
  left: 0;
  text-align: left;
  padding: 10px 8px 2px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.cell {
  position: relative;
  height: 32px;
  min-width: 32px;
  text-align: center;
  border-radius: 6px;
  background: var(--surface-2);
  font-weight: 600;
}

.acted {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 7px;
  height: 7px;
  transform: rotate(45deg);
  background: var(--danger);
  outline: 1px solid var(--surface);
}

.med.yes {
  color: var(--accent);
}

.med.no {
  color: var(--muted);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

/* Laptop: let a 30-day month fit without scrolling. */
@media (min-width: 1024px) {
  .date,
  .cell {
    min-width: 26px;
  }
}
</style>
