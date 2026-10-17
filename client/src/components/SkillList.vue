<script setup>
import { computed, ref } from 'vue';
import { useCatalogStore } from '../stores/catalog.js';
import { MODULES, moduleLabel } from '../utils/skills.js';
import { vAutogrow } from '../utils/autogrow.js';
import AppIcon from './AppIcon.vue';

// Settings → Skills: grouped by module (each group collapsible), with add, edit, reorder,
// move between modules, archive and restore.
const catalog = useCatalogStore();
const error = ref('');

const groups = computed(() =>
  MODULES.map((m) => ({ ...m, skills: catalog.skills.filter((s) => s.module === m.key && !s.archived) }))
);
const archived = computed(() => catalog.skills.filter((s) => s.archived));
const showArchived = ref(false);

const newName = ref('');
const newModule = ref('mindfulness');
const newDescription = ref('');

async function run(fn) {
  error.value = '';
  try {
    await fn();
  } catch (e) {
    error.value = e.message;
  }
}

const update = (skill, patch) => run(() => catalog.updateSkill(skill.id, patch));
const move = (skill, delta) => run(() => catalog.moveSkill(skill.id, delta));

function rename(skill, e) {
  const name = e.target.value.trim();
  if (!name) return (e.target.value = skill.name);
  if (name !== skill.name) update(skill, { name });
}

function describe(skill, e) {
  const description = e.target.value.trim();
  if (description !== skill.description) update(skill, { description });
}

function add() {
  const name = newName.value.trim();
  if (!name) return;
  run(async () => {
    await catalog.addSkill({ name, module: newModule.value, description: newDescription.value.trim() });
    newName.value = '';
    newDescription.value = '';
  });
}
</script>

<template>
  <div class="skill-list">
    <details v-for="g in groups" :key="g.key" class="card group">
      <summary>
        <span class="title">{{ g.label }}</span>
        <span class="muted small">{{ g.skills.length }} {{ g.skills.length === 1 ? 'skill' : 'skills' }}</span>
      </summary>
      <ul class="list">
        <li v-for="(s, i) in g.skills" :key="s.id" class="item">
          <div class="order">
            <button class="btn icon ghost" type="button" :disabled="i === 0" :aria-label="`Move ${s.name} up`" @click="move(s, -1)">
              <AppIcon name="up" :size="18" />
            </button>
            <button
              class="btn icon ghost"
              type="button"
              :disabled="i === g.skills.length - 1"
              :aria-label="`Move ${s.name} down`"
              @click="move(s, 1)"
            >
              <AppIcon name="down" :size="18" />
            </button>
          </div>
          <div class="fields">
            <input type="text" :value="s.name" maxlength="60" aria-label="Name" @change="rename(s, $event)" @keydown.enter="$event.target.blur()" />
            <textarea
              v-autogrow
              rows="1"
              maxlength="300"
              :value="s.description"
              placeholder="Description (optional)"
              aria-label="Description"
              @change="describe(s, $event)"
            />
            <label class="module">
              Module
              <select :value="s.module" @change="update(s, { module: $event.target.value })">
                <option v-for="m in MODULES" :key="m.key" :value="m.key">{{ m.label }}</option>
              </select>
            </label>
          </div>
          <button class="btn icon ghost" type="button" :aria-label="`Archive ${s.name}`" title="Archive" @click="update(s, { archived: true })">
            <AppIcon name="archive" :size="18" />
          </button>
        </li>
        <li v-if="!g.skills.length" class="item muted small">No skills in this module.</li>
      </ul>
    </details>

    <form class="card add" @submit.prevent="add">
      <h3>Add a skill</h3>
      <input v-model="newName" type="text" maxlength="60" placeholder="Skill name" aria-label="New skill name" />
      <textarea v-model="newDescription" v-autogrow rows="1" maxlength="300" placeholder="Description (optional)" aria-label="New skill description" />
      <div class="row">
        <select v-model="newModule" aria-label="Module">
          <option v-for="m in MODULES" :key="m.key" :value="m.key">{{ m.label }}</option>
        </select>
        <button class="btn" type="submit" :disabled="!newName.trim()"><AppIcon name="plus" :size="18" /> Add</button>
      </div>
    </form>

    <p v-if="error" class="error-text">{{ error }}</p>

    <div v-if="archived.length" class="archived">
      <button class="btn ghost small" type="button" :aria-expanded="showArchived" @click="showArchived = !showArchived">
        {{ showArchived ? 'Hide' : 'Show' }} archived ({{ archived.length }})
      </button>
      <ul v-if="showArchived" class="card list">
        <li v-for="s in archived" :key="s.id" class="item archived-item">
          <span>
            <span class="muted">{{ s.name }}</span>
            <span class="muted small"> · {{ moduleLabel(s.module) }}</span>
          </span>
          <button class="btn ghost" type="button" @click="update(s, { archived: false })">
            <AppIcon name="restore" :size="18" /> Restore
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.skill-list {
  display: grid;
  gap: 10px;
}

.group {
  padding: 0;
}

summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 52px;
  padding: 0 16px;
  cursor: pointer;
  list-style: none;
}

summary::-webkit-details-marker {
  display: none;
}

summary::after {
  content: '›';
  color: var(--muted);
  font-size: 1.3rem;
  transition: transform 0.15s;
}

details[open] summary::after {
  transform: rotate(90deg);
}

.title {
  font-weight: 600;
  margin-right: auto;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0 8px 4px;
}

.group .list {
  border-top: 1px solid var(--border);
}

.item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 10px 0;
}

.item + .item {
  border-top: 1px solid var(--border);
}

.order {
  display: flex;
  flex-direction: column;
}

.order .btn {
  min-height: 34px;
}

.fields {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 8px;
}

.fields textarea {
  min-height: var(--tap);
  font-size: 0.95rem;
}

.module {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 0.9rem;
}

.module select {
  width: auto;
  padding: 6px 10px;
}

.add {
  display: grid;
  gap: 8px;
}

.add h3 {
  font-size: 0.95rem;
}

.add select {
  width: auto;
  flex: 1;
}

.archived {
  display: grid;
  gap: 8px;
  justify-items: start;
}

.archived .list {
  width: 100%;
  padding: 4px 12px;
}

.archived-item {
  justify-content: space-between;
  align-items: center;
}
</style>
