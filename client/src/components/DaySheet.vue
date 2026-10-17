<script setup>
import { computed, ref, watch, nextTick, onMounted } from 'vue';
import { useCatalogStore } from '../stores/catalog.js';
import TrackerCard from './TrackerCard.vue';
import MedicationList from './MedicationList.vue';

// One day laid out as the diary card. Used editable on the Day screen and
// read-only in the PDF report, so the export looks just like the app.
const props = defineProps({
  day: { type: Object, required: true }, // normalized day (see stores/day.js)
  readonly: { type: Boolean, default: false },
});
const emit = defineEmits(['rate', 'acted', 'medication', 'notes']);

const catalog = useCatalogStore();

// Active items, plus archived ones that have data on this day.
const visibleTrackers = (list) => list.filter((t) => !t.archived || props.day.ratings[t.id]);
const emotions = computed(() => visibleTrackers(catalog.emotions));
const urges = computed(() => visibleTrackers(catalog.urges));
const medications = computed(() =>
  catalog.medications.filter((m) => !m.archived || props.day.medications[m.id] !== undefined)
);

const notesEl = ref(null);
function autoGrow() {
  const el = notesEl.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
}
watch(() => props.day.notes, () => nextTick(autoGrow));
onMounted(autoGrow);
</script>

<template>
  <div class="sheet-wrap">
    <div class="sheet" :class="{ readonly }">
      <div class="pane">
        <section>
          <h2 class="section-title">Emotions</h2>
          <div class="grid">
            <TrackerCard
              v-for="t in emotions"
              :key="t.id"
              :tracker="t"
              :rating="day.ratings[t.id]"
              :readonly="readonly"
              @rate="emit('rate', t, $event)"
            />
          </div>
        </section>

        <section>
          <h2 class="section-title">Urges</h2>
          <div class="grid">
            <TrackerCard
              v-for="t in urges"
              :key="t.id"
              :tracker="t"
              :rating="day.ratings[t.id]"
              :readonly="readonly"
              @rate="emit('rate', t, $event)"
              @acted="emit('acted', t, $event)"
            />
          </div>
        </section>
      </div>

      <div class="pane side">
        <section>
          <h2 class="section-title">Medications</h2>
          <MedicationList
            :medications="medications"
            :values="day.medications"
            :readonly="readonly"
            @set="(m, v) => emit('medication', m, v)"
          />
        </section>

        <section class="notes">
          <h2 class="section-title"><label for="day-notes">Notes</label></h2>
          <div v-if="readonly" class="card notes-text">
            <template v-if="day.notes?.trim()">{{ day.notes }}</template>
            <span v-else class="muted">No notes.</span>
          </div>
          <textarea
            v-else
            id="day-notes"
            ref="notesEl"
            class="card"
            rows="5"
            placeholder="How was today? Anything you want to remember or share…"
            :value="day.notes"
            @input="emit('notes', $event.target.value)"
          />
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sheet-wrap {
  container-type: inline-size;
}

.sheet {
  display: grid;
  gap: 24px;
}

.pane {
  display: grid;
  gap: 24px;
  align-content: start;
  min-width: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 12px;
}

.notes textarea {
  min-height: 140px;
  padding: 14px 16px;
  overflow: hidden;
}

.notes-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  min-height: 60px;
}

/* Wide screens (MacBook): ratings on the left, medications and notes alongside. */
@container (min-width: 900px) {
  .sheet {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
    align-items: start;
  }
  .side {
    position: sticky;
    top: 16px;
  }
}
</style>
