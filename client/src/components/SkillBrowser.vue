<script setup>
import { computed, ref, watch } from 'vue';
import { MODULES, filterSkills } from '../utils/skills.js';
import SkillCheckRow from './SkillCheckRow.vue';

// "Browse all skills": every skill with search and module filters. Full screen on a phone,
// a centred dialog on iPad and Mac. Uses <dialog> for focus trapping and Esc to close.
const props = defineProps({
  open: { type: Boolean, default: false },
  skills: { type: Array, required: true }, // active skills
  ticked: { type: Object, required: true }, // skillId → true for the day being viewed
});
const emit = defineEmits(['close', 'toggle']);

const dialog = ref(null);
const query = ref('');
const module = ref(null);

watch(
  () => props.open,
  (open) => {
    if (open) {
      query.value = '';
      module.value = null;
      dialog.value?.showModal();
    } else if (dialog.value?.open) {
      dialog.value.close();
    }
  }
);

const results = computed(() => filterSkills(props.skills, { query: query.value, module: module.value }));
const groups = computed(() =>
  MODULES.map((m) => ({ ...m, skills: results.value.filter((s) => s.module === m.key) })).filter((g) => g.skills.length)
);
const usedCount = computed(() => props.skills.filter((s) => props.ticked[s.id]).length);
</script>

<template>
  <dialog ref="dialog" class="browser" aria-labelledby="skills-title" @close="emit('close')" @cancel.prevent="emit('close')">
    <header class="head">
      <h2 id="skills-title">Skills</h2>
      <span class="muted small">{{ usedCount }} used</span>
      <span class="spacer" />
      <button class="btn primary" type="button" @click="emit('close')">Done</button>
    </header>

    <div class="controls">
      <input v-model="query" type="search" class="search" :placeholder="`Search ${skills.length} skills`" aria-label="Search skills" />
      <div class="chips" role="group" aria-label="Filter by module">
        <button type="button" class="chip" :aria-pressed="module === null" @click="module = null">All</button>
        <button
          v-for="m in MODULES"
          :key="m.key"
          type="button"
          class="chip"
          :aria-pressed="module === m.key"
          @click="module = module === m.key ? null : m.key"
        >
          {{ m.label }}
        </button>
      </div>
    </div>

    <div class="list">
      <section v-for="g in groups" :key="g.key">
        <h3 class="group-title">
          <span>{{ g.label }}</span>
          <span class="muted">{{ g.skills.length }} {{ g.skills.length === 1 ? 'skill' : 'skills' }}</span>
        </h3>
        <div class="card rows">
          <SkillCheckRow
            v-for="s in g.skills"
            :key="s.id"
            :skill="s"
            :checked="!!ticked[s.id]"
            @toggle="emit('toggle', s, $event)"
          />
        </div>
      </section>
      <p v-if="!groups.length" class="muted empty">No skills match “{{ query }}”.</p>
    </div>
  </dialog>
</template>

<style scoped>
.browser {
  /* Phone: full screen. */
  width: 100%;
  max-width: none;
  height: 100%;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: var(--bg);
  color: var(--text);
  flex-direction: column;
}

.browser[open] {
  display: flex;
}

.browser::backdrop {
  background: rgb(0 0 0 / 0.4);
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: calc(env(safe-area-inset-top) + 12px) 16px 8px;
}

.head h2 {
  font-size: 1.4rem;
}

.controls {
  display: grid;
  gap: 10px;
  padding: 4px 16px 10px;
  border-bottom: 1px solid var(--border);
}

.search {
  border-radius: 999px;
  padding-inline: 16px;
}

.chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  margin: 0 -16px;
  padding: 0 16px 2px;
}

.chip {
  flex: none;
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 0.92rem;
  cursor: pointer;
}

.chip[aria-pressed='true'] {
  background: var(--text);
  border-color: var(--text);
  color: var(--bg);
}

.list {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 8px 16px calc(env(safe-area-inset-bottom) + 24px);
}

.group-title {
  display: flex;
  justify-content: space-between;
  margin: 16px 4px 8px;
  font-size: 0.78rem;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.rows {
  padding: 0;
  overflow: hidden;
}

.rows > * + * {
  border-top: 1px solid var(--border);
}

.empty {
  text-align: center;
  margin-top: 32px;
}

/* iPad / Mac: a centred dialog. */
@media (min-width: 640px) {
  .browser {
    width: min(640px, calc(100% - 48px));
    height: min(760px, calc(100% - 48px));
    margin: auto;
    border-radius: var(--radius);
    box-shadow: 0 20px 60px rgb(0 0 0 / 0.25);
  }
  .head {
    padding-top: 16px;
  }
}
</style>
