<script setup>
import { ref, watch } from 'vue';
import CheckRow from './CheckRow.vue';

// "Sleep" on the Day screen: hours slept, and two checkboxes about how the night went.
const props = defineProps({
  sleep: { type: Object, default: null }, // null, or { hours, fellAsleepQuickly, stayedAsleep }
});
const emit = defineEmits(['set']);

// The box keeps exactly what she types ("7." on the way to "7.5"); only a valid number is saved.
const text = ref('');
const invalid = ref(false);
watch(
  () => props.sleep?.hours ?? null,
  (hours) => {
    if (parseHours(text.value) !== hours) text.value = hours === null ? '' : String(hours);
  },
  { immediate: true }
);

// '' → null, '8.2' or '8,2' → 8.2; anything else (or over 24) → undefined.
function parseHours(s) {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  if (!/^\d{1,2}(\.\d*)?$|^\.\d+$/.test(t)) return undefined;
  const n = Number(t);
  return n <= 24 ? n : undefined;
}

function update(changes) {
  emit('set', {
    hours: props.sleep?.hours ?? null,
    fellAsleepQuickly: props.sleep?.fellAsleepQuickly ?? false,
    stayedAsleep: props.sleep?.stayedAsleep ?? false,
    ...changes,
  });
}

function onHours(value) {
  text.value = value;
  const hours = parseHours(value);
  invalid.value = hours === undefined;
  if (!invalid.value && hours !== (props.sleep?.hours ?? null)) update({ hours });
}
</script>

<template>
  <div class="card sleep-card">
    <label class="hours">
      <span class="label">Hours slept</span>
      <input
        type="text"
        inputmode="decimal"
        placeholder="e.g. 7.5"
        :value="text"
        :class="{ invalid }"
        :aria-invalid="invalid"
        @input="onHours($event.target.value)"
      />
    </label>
    <p v-if="invalid" class="error-text hint">Enter a number of hours from 0 to 24.</p>
    <CheckRow label="Fell asleep quickly" :checked="!!sleep?.fellAsleepQuickly" @toggle="update({ fellAsleepQuickly: $event })" />
    <CheckRow label="Stayed asleep" :checked="!!sleep?.stayedAsleep" @toggle="update({ stayedAsleep: $event })" />
  </div>
</template>

<style scoped>
.sleep-card {
  padding: 0;
  overflow: hidden;
}

.sleep-card > * + * {
  border-top: 1px solid var(--border);
}

.sleep-card > .hint {
  border-top: 0;
  margin: -6px 16px 10px;
}

.hours {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
}

.label {
  flex: 1;
  font-weight: 550;
}

.hours input {
  width: 110px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.hours input.invalid {
  border-color: var(--danger);
}
</style>
