<script setup>
import { computed, ref, watch } from 'vue';
import { useCatalogStore } from '../stores/catalog.js';
import { recentSkillIds } from '../utils/skills.js';
import SkillCheckRow from './SkillCheckRow.vue';
import SkillBrowser from './SkillBrowser.vue';

// "Skills" on the Day screen: today's ticks plus recent skills, and "Browse all skills".
const props = defineProps({
  day: { type: Object, required: true }, // normalized day
});
const emit = defineEmits(['toggle']);

const catalog = useCatalogStore();
const browsing = ref(false);

// The list is worked out when a day opens and then kept steady, so rows don't jump around
// while she ticks them. Skills ticked from Browse are added to the end.
const shownIds = ref([]);
watch(
  () => [props.day.date, catalog.skills.length],
  () => (shownIds.value = recentSkillIds(catalog.skills, props.day.skills)),
  { immediate: true }
);
watch(
  () => Object.keys(props.day.skills),
  (ids) => {
    for (const id of ids.map(Number)) if (!shownIds.value.includes(id)) shownIds.value.push(id);
  }
);

const shown = computed(() => shownIds.value.map((id) => catalog.skills.find((s) => s.id === id)).filter(Boolean));
const activeSkills = computed(() => catalog.skills.filter((s) => !s.archived));
const usedToday = computed(() => Object.keys(props.day.skills).length);
</script>

<template>
  <section class="skills">
    <h2 class="section-title">
      Skills
      <span class="muted small">{{ usedToday }} used today · Recent</span>
    </h2>
    <div class="card rows">
      <SkillCheckRow
        v-for="s in shown"
        :key="s.id"
        :skill="s"
        :checked="!!day.skills[s.id]"
        @toggle="emit('toggle', s, $event)"
      />
      <p v-if="!shown.length" class="muted small none">No skills set up. Add them in Settings.</p>
      <button class="browse" type="button" @click="browsing = true">Browse all skills</button>
    </div>

    <SkillBrowser
      :open="browsing"
      :skills="activeSkills"
      :ticked="day.skills"
      @close="browsing = false"
      @toggle="(s, used) => emit('toggle', s, used)"
    />
  </section>
</template>

<style scoped>
.section-title {
  font-weight: 650;
}

.section-title .small {
  font-weight: 400;
}

.rows {
  padding: 0;
  overflow: hidden;
}

.rows > * + * {
  border-top: 1px solid var(--border);
}

.browse {
  width: 100%;
  min-height: 52px;
  border: 0;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-weight: 550;
  cursor: pointer;
}

@media (hover: hover) {
  .browse:hover {
    background: var(--surface-2);
  }
}

.none {
  margin: 0;
  padding: 16px;
}

/* Two columns of skills on wide screens, so the list doesn't stretch across the page. */
@media (min-width: 1024px) {
  .rows {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .rows > * + * {
    border-top: 0;
  }
  .rows > :not(.browse) {
    border-bottom: 1px solid var(--border);
  }
  .rows > :nth-child(even):not(.browse) {
    border-left: 1px solid var(--border);
  }
  .browse,
  .none {
    grid-column: 1 / -1;
  }
}
</style>
