<script setup>
import { computed } from 'vue';
import { addDays, formatShort, formatWeekday, formatLong } from '../utils/dates.js';

// Calendar of the History range, Sunday-first weeks, with period days in red (deeper for
// heavier flow). Days either side of the range that fill out the first and last week are faded.
const props = defineProps({
  report: { type: Object, required: true }, // from buildReport()
});

const FLOW_LABELS = { light: 'Light', medium: 'Medium', heavy: 'Heavy' };

const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

const weeks = computed(() => {
  const { dates, period } = props.report;
  const byDate = Object.fromEntries(dates.map((d, i) => [d, period[i]]));
  const first = addDays(dates[0], -weekday(dates[0]));
  const last = addDays(dates.at(-1), 6 - weekday(dates.at(-1)));
  const out = [];
  for (let d = first; d <= last; d = addDays(d, 7)) {
    out.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(d, i);
        const inRange = date in byDate;
        return { date, inRange, period: inRange ? byDate[date] : null };
      })
    );
  }
  return out;
});

const headers = computed(() => weeks.value[0].map((c) => formatWeekday(c.date)));
const marked = computed(() => props.report.period.filter(Boolean).length);

// Day number, with the month on the first cell and on the 1st so month changes are clear.
const label = (cell, i, w) => (cell.date.endsWith('-01') || (i === 0 && w === 0) ? formatShort(cell.date) : Number(cell.date.slice(8)));

function title(cell) {
  if (!cell.period) return formatLong(cell.date);
  const flow = FLOW_LABELS[cell.period.flow];
  return `${formatLong(cell.date)}: bleeding${flow ? `, ${flow.toLowerCase()} flow` : ''}`;
}
</script>

<template>
  <figure class="card period-cal">
    <figcaption>
      <h3>Period days</h3>
      <span class="muted small">{{ marked }} {{ marked === 1 ? 'day' : 'days' }} marked</span>
    </figcaption>
    <table class="cal">
      <thead>
        <tr>
          <th v-for="(h, i) in headers" :key="i" scope="col" class="muted">{{ h }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(week, w) in weeks" :key="week[0].date">
          <td v-for="(cell, i) in week" :key="cell.date">
            <RouterLink
              v-if="cell.inRange"
              :to="`/day/${cell.date}`"
              class="day"
              :class="cell.period && `flow-${cell.period.flow ?? 'unset'}`"
              :title="title(cell)"
              :aria-label="title(cell)"
            >
              {{ label(cell, i, w) }}
            </RouterLink>
            <span v-else class="day outside" aria-hidden="true">{{ label(cell, i, w) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="legend muted small" aria-hidden="true">
      <span v-for="(name, flow) in FLOW_LABELS" :key="flow"><span class="swatch" :class="`flow-${flow}`" /> {{ name }}</span>
    </div>
  </figure>
</template>

<style scoped>
.period-cal {
  margin: 0;
  display: grid;
  gap: 10px;
  max-width: 480px;
}

figcaption {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.cal {
  width: 100%;
  border-collapse: separate;
  border-spacing: 4px;
  table-layout: fixed;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

th {
  font-weight: 550;
  font-size: 0.75rem;
  padding-bottom: 2px;
}

td {
  padding: 0;
}

.day {
  display: grid;
  place-items: center;
  height: 38px;
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
}

.day.outside {
  background: transparent;
  color: var(--muted);
  opacity: 0.5;
  font-weight: 400;
}

.flow-light {
  background: color-mix(in srgb, var(--period) 30%, var(--surface));
}

.flow-medium,
.flow-unset {
  background: color-mix(in srgb, var(--period) 62%, var(--surface));
}

.flow-heavy {
  background: var(--period);
  color: var(--period-contrast);
}

@media (hover: hover) {
  a.day:hover {
    outline: 2px solid var(--period);
    outline-offset: -2px;
  }
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.legend > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}
</style>
