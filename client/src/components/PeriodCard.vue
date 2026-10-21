<script setup>
import CheckRow from './CheckRow.vue';

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
    <CheckRow label="Bleeding" tone="period" :checked="!!period" @toggle="toggle" />
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

.flow {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 16px 12px;
  border-top: 1px solid var(--border);
}

.label {
  flex: 1;
  font-weight: 550;
}

.flow select {
  width: auto;
  min-width: 140px;
}
</style>
