<script setup>
import { computed, ref } from 'vue';
import { useCatalogStore } from '../stores/catalog.js';
import AppIcon from './AppIcon.vue';

// Editable list for Settings. `kind` is 'emotion' | 'urge' | 'medication'.
const props = defineProps({ kind: { type: String, required: true } });

const catalog = useCatalogStore();
const isMed = computed(() => props.kind === 'medication');
const items = computed(() => (isMed.value ? catalog.medications : props.kind === 'emotion' ? catalog.emotions : catalog.urges));
const active = computed(() => items.value.filter((i) => !i.archived));
const archived = computed(() => items.value.filter((i) => i.archived));
const showArchived = ref(false);
const scales = Array.from({ length: 10 }, (_, i) => i + 1);

const newName = ref('');
const newDose = ref('');
const error = ref('');

async function run(fn) {
  error.value = '';
  try {
    await fn();
  } catch (e) {
    error.value = e.message;
  }
}

function add() {
  const name = newName.value.trim();
  if (!name) return;
  run(async () => {
    if (isMed.value) await catalog.addMedication({ name, dose: newDose.value.trim() });
    else await catalog.addTracker({ kind: props.kind, name });
    newName.value = '';
    newDose.value = '';
  });
}

function update(item, patch) {
  run(() => (isMed.value ? catalog.updateMedication(item.id, patch) : catalog.updateTracker(item.id, patch)));
}

function rename(item, e) {
  const name = e.target.value.trim();
  if (!name) {
    e.target.value = item.name;
    return;
  }
  if (name !== item.name) update(item, { name });
}

function setDose(item, e) {
  const dose = e.target.value.trim();
  if (dose !== item.dose) update(item, { dose });
}

function move(item, delta) {
  run(() => (isMed.value ? catalog.moveMedication(item.id, delta) : catalog.moveTracker(item.id, delta)));
}

const placeholder = computed(
  () => ({ emotion: 'New emotion, e.g. Overwhelmed', urge: 'New urge, e.g. Skip meals', medication: 'Medication name' })[props.kind]
);
</script>

<template>
  <div class="item-list">
    <ul class="card list">
      <li v-for="(item, i) in active" :key="item.id" class="item">
        <div class="order">
          <button class="btn icon ghost" type="button" :disabled="i === 0" :aria-label="`Move ${item.name} up`" @click="move(item, -1)">
            <AppIcon name="up" :size="18" />
          </button>
          <button
            class="btn icon ghost"
            type="button"
            :disabled="i === active.length - 1"
            :aria-label="`Move ${item.name} down`"
            @click="move(item, 1)"
          >
            <AppIcon name="down" :size="18" />
          </button>
        </div>

        <div class="fields">
          <input type="text" :value="item.name" maxlength="60" aria-label="Name" @change="rename(item, $event)" @keydown.enter="$event.target.blur()" />
          <div class="options">
            <template v-if="isMed">
              <input
                type="text"
                class="dose"
                :value="item.dose"
                maxlength="60"
                placeholder="Dose (optional)"
                aria-label="Dose"
                @change="setDose(item, $event)"
                @keydown.enter="$event.target.blur()"
              />
            </template>
            <template v-else>
              <label class="opt">
                Scale 0 –
                <select :value="item.scaleMax" @change="update(item, { scaleMax: Number($event.target.value) })">
                  <option v-for="n in scales" :key="n" :value="n">{{ n }}</option>
                </select>
              </label>
              <label class="opt check">
                <input type="checkbox" :checked="item.trackActed" @change="update(item, { trackActed: $event.target.checked })" />
                Ask “acted on it?”
              </label>
            </template>
          </div>
        </div>

        <button class="btn icon ghost" type="button" :aria-label="`Archive ${item.name}`" title="Archive" @click="update(item, { archived: true })">
          <AppIcon name="archive" :size="18" />
        </button>
      </li>
      <li v-if="!active.length" class="item muted small">Nothing here yet.</li>
    </ul>

    <form class="add" @submit.prevent="add">
      <input v-model="newName" type="text" maxlength="60" :placeholder="placeholder" :aria-label="placeholder" />
      <input v-if="isMed" v-model="newDose" type="text" maxlength="60" placeholder="Dose (optional)" aria-label="Dose" />
      <button class="btn" type="submit" :disabled="!newName.trim()"><AppIcon name="plus" :size="18" /> Add</button>
    </form>

    <p v-if="error" class="error-text">{{ error }}</p>

    <div v-if="archived.length" class="archived">
      <button class="btn ghost small" type="button" :aria-expanded="showArchived" @click="showArchived = !showArchived">
        {{ showArchived ? 'Hide' : 'Show' }} archived ({{ archived.length }})
      </button>
      <ul v-if="showArchived" class="card list">
        <li v-for="item in archived" :key="item.id" class="item archived-item">
          <span class="muted">{{ item.name }}</span>
          <button class="btn ghost" type="button" @click="update(item, { archived: false })">
            <AppIcon name="restore" :size="18" /> Restore
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.item-list {
  display: grid;
  gap: 10px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 4px 8px;
}

.item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0;
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

.options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.opt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  color: var(--muted);
}

.opt select {
  width: auto;
  padding: 6px 10px;
}

.check input {
  width: 20px;
  height: 20px;
  accent-color: var(--accent);
}

.dose {
  max-width: 260px;
}

.add {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.add input {
  flex: 1 1 200px;
}

.archived {
  display: grid;
  gap: 8px;
  justify-items: start;
}

.archived .list {
  width: 100%;
}

.archived-item {
  justify-content: space-between;
}
</style>
