<script setup>
import { computed } from 'vue';
import RatingScale from './RatingScale.vue';
import YesNo from './YesNo.vue';

const props = defineProps({
  tracker: { type: Object, required: true },
  rating: { type: Object, default: null }, // { value, scaleMax, actedOn }
  readonly: { type: Boolean, default: false },
});
defineEmits(['rate', 'acted']);

// A past entry keeps the scale it was recorded on, even if the tracker's scale changed later.
const max = computed(() => props.rating?.scaleMax ?? props.tracker.scaleMax);
const tone = computed(() => (props.tracker.kind === 'urge' ? 'urge' : 'accent'));
const showActed = computed(() => props.tracker.trackActed || props.rating?.actedOn != null);
</script>

<template>
  <div class="card tracker">
    <div class="head">
      <h3>{{ tracker.name }}</h3>
      <span class="value muted small">
        <template v-if="rating">{{ rating.value }} / {{ max }}</template>
        <template v-else-if="readonly">Not rated</template>
      </span>
    </div>
    <RatingScale
      :model-value="rating?.value ?? null"
      :max="max"
      :tone="tone"
      :label="`${tracker.name} intensity`"
      :readonly="readonly"
      @update:model-value="$emit('rate', $event)"
    />
    <div v-if="showActed" class="acted">
      <span class="small">Acted on it?</span>
      <YesNo
        :model-value="rating?.actedOn ?? null"
        :label="`Acted on ${tracker.name}`"
        :disabled="!readonly && !rating"
        :readonly="readonly"
        @update:model-value="$emit('acted', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.tracker {
  display: grid;
  gap: 10px;
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.value {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.acted {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
</style>
