<script setup>
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';
import { addDays, formatLong, relativeLabel, currentDay } from '../utils/dates.js';

const props = defineProps({ date: { type: String, required: true } });
const emit = defineEmits(['change']);

const today = () => currentDay.value;
const isToday = computed(() => props.date === currentDay.value);
const canGoForward = computed(() => props.date < currentDay.value);
// Reading currentDay makes the label update at midnight.
const relative = computed(() => (currentDay.value, relativeLabel(props.date)));

function pick(e) {
  if (e.target.value) emit('change', e.target.value);
}
</script>

<template>
  <div class="date-nav">
    <button class="btn icon ghost" type="button" aria-label="Previous day" @click="emit('change', addDays(date, -1))">
      <AppIcon name="left" />
    </button>

    <!-- The transparent date input sits over the label so tapping it opens the native date picker. -->
    <label class="current">
      <span class="rel">{{ relative ?? formatLong(date).split(',')[0] }}</span>
      <span class="full">{{ formatLong(date) }}</span>
      <input type="date" :value="date" :max="today()" aria-label="Choose a date" @change="pick" />
    </label>

    <button
      class="btn icon ghost"
      type="button"
      aria-label="Next day"
      :disabled="!canGoForward"
      @click="emit('change', addDays(date, 1))"
    >
      <AppIcon name="right" />
    </button>

    <button v-if="!isToday" class="btn today" type="button" @click="emit('change', today())">Today</button>
  </div>
</template>

<style scoped>
.date-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.current {
  position: relative;
  display: grid;
  min-width: 0;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.rel {
  font-size: 1.3rem;
  font-weight: 650;
  line-height: 1.2;
}

.full {
  color: var(--muted);
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.current input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0;
  border: 0;
  opacity: 0;
  cursor: pointer;
}

.current:focus-within {
  outline: 2px solid var(--focus);
}

.today {
  margin-left: 4px;
}
</style>
