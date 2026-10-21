<script setup>
import AppIcon from './AppIcon.vue';

// "Period" on the Day screen: a bleeding checkbox, and a flow choice once it's ticked.
const props = defineProps({
  period: { type: Object, default: null }, // null, or { flow: 'light' | 'medium' | 'heavy' | null }
});
const emit = defineEmits(['set']);

const FLOWS = [
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'heavy', label: 'Heavy' },
];

// Unticking forgets the flow, so ticking again starts fresh.
const toggle = () => emit('set', props.period ? null : { flow: null });
const setFlow = (value) => emit('set', { flow: value || null });
</script>

<template>
  <div class="card period-card">
    <button type="button" class="bleed-row" role="checkbox" :aria-checked="!!period" @click="toggle">
      <span class="label">Bleeding</span>
      <span class="box" :class="{ on: !!period }" aria-hidden="true">
        <AppIcon v-if="period" name="check" :size="18" />
      </span>
    </button>
    <label v-if="period" class="flow">
      <span class="label">Flow</span>
      <select :value="period.flow ?? ''" @change="setFlow($event.target.value)">
        <option value="">Not set</option>
        <option v-for="f in FLOWS" :key="f.value" :value="f.value">{{ f.label }}</option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.period-card {
  padding: 0;
  overflow: hidden;
}

.bleed-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 56px;
  padding: 12px 16px;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.label {
  flex: 1;
  font-weight: 550;
}

.box {
  flex: none;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 2px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  color: var(--period-contrast);
  transition: background-color 0.12s, border-color 0.12s;
}

.box.on {
  background: var(--period);
  border-color: var(--period);
}

@media (hover: hover) {
  .bleed-row:hover .box:not(.on) {
    border-color: var(--period);
  }
}

.flow {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 16px 12px;
  border-top: 1px solid var(--border);
}

.flow select {
  width: auto;
  min-width: 140px;
}
</style>
