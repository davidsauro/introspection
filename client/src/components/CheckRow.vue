<script setup>
import AppIcon from './AppIcon.vue';

// A full-width row with a label and a checkbox on the right; the whole row is the control.
defineProps({
  label: { type: String, required: true },
  checked: { type: Boolean, default: false },
  tone: { type: String, default: 'accent' }, // colour token for the ticked box: 'accent' | 'period'
});
defineEmits(['toggle']);
</script>

<template>
  <button
    type="button"
    class="check-row"
    :style="{ '--tone': `var(--${tone})`, '--tone-contrast': `var(--${tone}-contrast)` }"
    role="checkbox"
    :aria-checked="checked"
    @click="$emit('toggle', !checked)"
  >
    <span class="label">{{ label }}</span>
    <span class="box" :class="{ on: checked }" aria-hidden="true">
      <AppIcon v-if="checked" name="check" :size="18" />
    </span>
  </button>
</template>

<style scoped>
.check-row {
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
  color: var(--tone-contrast);
  transition: background-color 0.12s, border-color 0.12s;
}

.box.on {
  background: var(--tone);
  border-color: var(--tone);
}

@media (hover: hover) {
  .check-row:hover .box:not(.on) {
    border-color: var(--tone);
  }
}
</style>
