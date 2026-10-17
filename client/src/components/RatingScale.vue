<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  modelValue: { type: Number, default: null },
  max: { type: Number, required: true },
  label: { type: String, required: true },
  tone: { type: String, default: 'accent' }, // 'accent' | 'urge'
});
const emit = defineEmits(['update:modelValue']);

const values = computed(() => Array.from({ length: props.max + 1 }, (_, i) => i));
const buttons = ref([]);

// Roving tabindex: the selected value (or 0) is the one tab stop in the group.
const tabStop = computed(() => props.modelValue ?? 0);

function select(v) {
  // Tapping the current value again clears it.
  emit('update:modelValue', v === props.modelValue ? null : v);
}

function onKey(e, v) {
  let next = null;
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(props.max, v + 1);
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(0, v - 1);
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = props.max;
  else if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    return emit('update:modelValue', null);
  }
  if (next === null) return;
  e.preventDefault();
  emit('update:modelValue', next);
  buttons.value[next]?.focus();
}
</script>

<template>
  <!-- The wrapper is the size container, so long scales can wrap based on the card's width. -->
  <div class="scale-wrap">
    <div
      class="scale"
      :class="[`tone-${tone}`, { split: max > 5 }]"
      role="radiogroup"
      :aria-label="label"
      :style="{ '--n': max + 1, '--half': Math.ceil((max + 1) / 2) }"
    >
      <button
        v-for="v in values"
        :key="v"
        :ref="(el) => (buttons[v] = el)"
        type="button"
        role="radio"
        :aria-checked="v === modelValue"
        :aria-label="`${v} of ${max}`"
        :tabindex="v === tabStop ? 0 : -1"
        :class="{ selected: v === modelValue, below: modelValue !== null && v < modelValue }"
        @click="select(v)"
        @keydown="onKey($event, v)"
      >
        {{ v }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.scale-wrap {
  container-type: inline-size;
}

.scale {
  --c: var(--accent);
  --cc: var(--accent-contrast);
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  gap: 6px;
}

.scale.tone-urge {
  --c: var(--urge);
  --cc: var(--urge-contrast);
}

/* Scales longer than 0–5 split into two even rows when one row would make buttons too narrow. */
@container (max-width: 459px) {
  .scale.split {
    grid-template-columns: repeat(var(--half), 1fr);
  }
}

button {
  min-height: var(--tap);
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
}

button.below {
  background: color-mix(in srgb, var(--c) 22%, var(--surface));
  border-color: color-mix(in srgb, var(--c) 30%, var(--border));
}

button.selected {
  background: var(--c);
  border-color: var(--c);
  color: var(--cc);
}

@media (hover: hover) {
  .scale button:not(.selected):hover {
    border-color: var(--c);
  }
}
</style>
