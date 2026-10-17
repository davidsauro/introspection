<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: null },
  label: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

function pick(v) {
  if (props.readonly || props.disabled) return;
  // Tapping the current answer again clears it.
  emit('update:modelValue', props.modelValue === v ? null : v);
}

function onKey(e) {
  if (props.readonly || props.disabled) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault();
    emit('update:modelValue', props.modelValue === true ? false : true);
  }
}
</script>

<template>
  <div class="segmented" role="radiogroup" :aria-label="label" @keydown="onKey">
    <button
      type="button"
      role="radio"
      class="yes"
      :aria-checked="modelValue === true"
      :disabled="disabled"
      :tabindex="readonly ? -1 : modelValue === false ? -1 : 0"
      @click="pick(true)"
    >
      Yes
    </button>
    <button
      type="button"
      role="radio"
      class="no"
      :aria-checked="modelValue === false"
      :disabled="disabled"
      :tabindex="readonly ? -1 : modelValue === false ? 0 : -1"
      @click="pick(false)"
    >
      No
    </button>
  </div>
</template>
