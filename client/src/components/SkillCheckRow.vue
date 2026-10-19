<script setup>
import AppIcon from './AppIcon.vue';

// One skill with its description and a "used today" checkbox. The whole row is the control,
// apart from an optional star on the left (show on the Day screen), kept away from the checkbox.
defineProps({
  skill: { type: Object, required: true },
  checked: { type: Boolean, default: false },
  starrable: { type: Boolean, default: false },
});
defineEmits(['toggle', 'star']);
</script>

<template>
  <div class="skill-check">
    <button
      v-if="starrable"
      type="button"
      class="star"
      :class="{ on: skill.starred }"
      :aria-pressed="skill.starred"
      :aria-label="`Show ${skill.name} on the Day screen`"
      :title="skill.starred ? 'Shown on the Day screen' : 'Show on the Day screen'"
      @click="$emit('star', !skill.starred)"
    >
      <AppIcon name="star" :size="20" :filled="skill.starred" />
    </button>
    <button
      type="button"
      class="skill-row"
      :class="{ starrable }"
      role="checkbox"
      :aria-checked="checked"
      @click="$emit('toggle', !checked)"
    >
      <span class="text">
        <span class="name">{{ skill.name }}</span>
        <span v-if="skill.description" class="desc">{{ skill.description }}</span>
      </span>
      <span class="box" :class="{ on: checked }" aria-hidden="true">
        <AppIcon v-if="checked" name="check" :size="18" />
      </span>
    </button>
  </div>
</template>

<style scoped>
.skill-check {
  display: flex;
  align-items: stretch;
}

.star {
  flex: none;
  display: grid;
  place-items: center;
  width: 48px;
  padding: 0 0 0 4px;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.star.on {
  color: var(--star);
}

.skill-row {
  flex: 1;
  min-width: 0;
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

.skill-row.starrable {
  padding-left: 4px;
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
