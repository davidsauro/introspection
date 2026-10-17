<script setup>
import { computed } from 'vue';
import RatingScale from './RatingScale.vue';
import YesNo from './YesNo.vue';
import { vAutogrow } from '../utils/autogrow.js';

const props = defineProps({
  tracker: { type: Object, required: true },
  rating: { type: Object, default: null }, // { value, scaleMax, actedOn }
  note: { type: String, default: '' },
});
defineEmits(['rate', 'acted', 'note']);

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
      </span>
    </div>
    <RatingScale
      :model-value="rating?.value ?? null"
      :max="max"
      :tone="tone"
      :label="`${tracker.name} intensity`"
      @update:model-value="$emit('rate', $event)"
    />
    <div v-if="showActed" class="acted">
      <span class="small">Acted on it?</span>
      <YesNo
        :model-value="rating?.actedOn ?? null"
        :label="`Acted on ${tracker.name}`"
        :disabled="!rating"
        @update:model-value="$emit('acted', $event)"
      />
    </div>
    <textarea
      v-autogrow
      class="note"
      rows="1"
      maxlength="5000"
      :value="note"
      :placeholder="`Notes about ${tracker.name.toLowerCase()}…`"
      :aria-label="`Notes about ${tracker.name}`"
      @input="$emit('note', $event.target.value)"
    />
  </div>
</template>

<style scoped>
.tracker {
  display: grid;
  gap: 10px;
  /* Cards in a row share the tallest card's height; keep content at the top, not spread out. */
  align-content: start;
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

/* A quiet one-line box that grows with the text (v-autogrow). */
.note {
  min-height: var(--tap);
  padding: 10px 12px;
  line-height: 1.4;
  background: var(--bg);
  border-color: transparent;
}

.note:focus {
  background: var(--surface);
  border-color: var(--border);
}

.note::placeholder {
  color: var(--muted);
}
</style>
