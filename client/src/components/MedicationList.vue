<script setup>
import YesNo from './YesNo.vue';

defineProps({
  medications: { type: Array, required: true },
  values: { type: Object, required: true }, // medicationId → true | false
  readonly: { type: Boolean, default: false },
});
defineEmits(['set']);
</script>

<template>
  <div class="card meds">
    <p v-if="!medications.length" class="muted small empty">
      No medications set up yet.
      <RouterLink v-if="!readonly" to="/settings">Add them in Settings.</RouterLink>
    </p>
    <div v-for="m in medications" :key="m.id" class="med">
      <div class="name">
        <span>{{ m.name }}</span>
        <span v-if="m.dose" class="muted small">{{ m.dose }}</span>
      </div>
      <YesNo
        :model-value="values[m.id] ?? null"
        :label="`Took ${m.name}`"
        :readonly="readonly"
        @update:model-value="$emit('set', m, $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.meds {
  padding-block: 6px;
}

.name .small {
  font-weight: 400;
}

.med {
  break-inside: avoid;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
}

.med + .med {
  border-top: 1px solid var(--border);
}

.name {
  display: grid;
  min-width: 0;
  font-weight: 550;
}

.empty {
  margin: 8px 0;
}
</style>
