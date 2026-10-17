<script setup>
import AppIcon from './AppIcon.vue';

// One skill with its description and a "used today" checkbox. The whole row is the control.
defineProps({
  skill: { type: Object, required: true },
  checked: { type: Boolean, default: false },
});
defineEmits(['toggle']);
</script>

<template>
  <button type="button" class="skill-row" role="checkbox" :aria-checked="checked" @click="$emit('toggle', !checked)">
    <span class="text">
      <span class="name">{{ skill.name }}</span>
      <span v-if="skill.description" class="desc">{{ skill.description }}</span>
    </span>
    <span class="box" :class="{ on: checked }" aria-hidden="true">
      <AppIcon v-if="checked" name="check" :size="18" />
    </span>
  </button>
</template>

<style scoped>
.skill-row {
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

.text {
  flex: 1;
  display: grid;
  gap: 2px;
  min-width: 0;
}

.name {
  font-weight: 550;
}

.desc {
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.35;
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
  color: var(--accent-contrast);
  transition: background-color 0.12s, border-color 0.12s;
}

.box.on {
  background: var(--accent);
  border-color: var(--accent);
}

@media (hover: hover) {
  .skill-row:hover .box:not(.on) {
    border-color: var(--accent);
  }
}
</style>
