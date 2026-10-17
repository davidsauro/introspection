<script setup>
import { computed } from 'vue';
import { useStatsStore } from '../stores/stats.js';

const stats = useStatsStore();
const boxes = computed(() => [
  { value: stats.streak, label: 'Day Streak', accent: true },
  { value: stats.skillsUsed, label: 'Skills Used' },
  { value: stats.totalEntries, label: 'Total Entries' },
]);
</script>

<template>
  <section class="card stats" aria-label="Summary">
    <div v-for="b in boxes" :key="b.label" class="stat">
      <span class="value" :class="{ accent: b.accent }">{{ b.value ?? '–' }}</span>
      <span class="label">{{ b.label }}</span>
    </div>
  </section>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 0;
  margin-bottom: 20px;
}

.stat {
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 14px 8px 12px;
  text-align: center;
}

.stat + .stat {
  border-left: 1px solid var(--border);
}

.value {
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.value.accent {
  color: var(--accent);
}

.label {
  color: var(--muted);
  font-size: 0.82rem;
}

@media (min-width: 640px) {
  .value {
    font-size: 1.9rem;
  }
  .label {
    font-size: 0.9rem;
  }
}
</style>
