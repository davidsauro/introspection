<script setup>
import { formatWeekday } from '../utils/dates.js';
import { formatNumber } from '../utils/report.js';

// Tracker × date heatmap with period and sleep rows, and a medication row per medication.
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

// A sleep checkbox for one night: ticked, unticked on a night with a sleep entry, or no entry.
const sleepMark = (night, key) => (!night ? '' : night[key] ? '✓' : '✗');
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

        <tr class="section">
          <th :colspan="report.dates.length + 1" scope="colgroup">Period</th>
        </tr>
        <tr>
          <th class="name" scope="row">Bleeding</th>
          <td v-for="(p, i) in report.period" :key="i" class="cell period">
            <span v-if="p" class="bleed" title="Bleeding" aria-label="bleeding" />
          </td>
        </tr>

        <tr class="section">
          <th :colspan="report.dates.length + 1" scope="colgroup">Sleep <span class="note">(the night before)</span></th>
        </tr>
        <tr>
          <th class="name" scope="row">Hours slept</th>
          <td v-for="(n, i) in report.sleep.nights" :key="i" class="cell sleep" :class="{ has: n?.hours != null }">
            {{ n?.hours != null ? formatNumber(n.hours) : '' }}
          </td>
        </tr>
        <tr v-for="row in [
          { key: 'fellAsleepQuickly', label: 'Fell asleep quickly' },
          { key: 'stayedAsleep', label: 'Stayed asleep' },
        ]" :key="row.key">
          <th class="name" scope="row" :title="row.label">{{ row.label }}</th>
          <td v-for="(n, i) in report.sleep.nights" :key="i" class="cell sleep-check" :class="{ yes: n?.[row.key] }">
            {{ sleepMark(n, row.key) }}
          </td>
        </tr>

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

        <template v-if="report.skills.length">
          <tr class="section">
            <th :colspan="report.dates.length + 1" scope="colgroup">Skills used</th>
          </tr>
          <tr v-for="s in report.skills" :key="s.skill.id">
            <th class="name" scope="row" :title="s.skill.name">{{ s.skill.name }}</th>
            <td v-for="(used, i) in s.used" :key="i" class="cell skill" :class="{ used }">
              {{ used ? '✓' : '' }}
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

.period {
  vertical-align: middle;
}

.bleed {
  display: block;
  width: 16px;
  height: 16px;
  margin: auto;
  border-radius: 3px;
  background: var(--period);
}

.section .note {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}

.sleep.has {
  background: color-mix(in srgb, var(--sleep) 20%, var(--surface));
}

.sleep-check {
  color: var(--muted);
}

.sleep-check.yes {
  color: var(--sleep);
}

.skill.used {
  background: color-mix(in srgb, var(--accent) 22%, var(--surface));
  color: var(--accent);
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
