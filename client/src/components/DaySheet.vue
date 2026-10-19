<script setup>
import { computed } from 'vue';
import { useCatalogStore } from '../stores/catalog.js';
import { visibleForDay } from '../utils/report.js';
import { vAutogrow } from '../utils/autogrow.js';
import TrackerCard from './TrackerCard.vue';
import MedicationList from './MedicationList.vue';
import SkillsSection from './SkillsSection.vue';

// One day laid out as the diary card on the Day screen. The PDF (src/pdf/document.js)
// shows the same items via visibleForDay().
const props = defineProps({
  day: { type: Object, required: true }, // normalized day (see stores/day.js)
});
const emit = defineEmits(['rate', 'acted', 'medication', 'notes', 'tracker-note', 'skill']);

const catalog = useCatalogStore();
const visible = computed(() => visibleForDay(catalog, props.day));
</script>

<template>
  <div class="sheet-wrap">
    <div class="sheet">
      <div class="pane">
        <section>
          <h2 class="section-title">Emotions</h2>
          <p v-if="!visible.emotions.length" class="muted small empty">No emotions set up. Add them in Settings.</p>
          <div class="grid">
            <TrackerCard
              v-for="t in visible.emotions"
              :key="t.id"
              :tracker="t"
              :rating="day.ratings[t.id]"
              :note="day.trackerNotes[t.id] ?? ''"
              @rate="emit('rate', t, $event)"
              @note="emit('tracker-note', t, $event)"
            />
          </div>
        </section>

        <section>
          <h2 class="section-title">Urges</h2>
          <p v-if="!visible.urges.length" class="muted small empty">No urges set up. Add them in Settings.</p>
          <div class="grid">
            <TrackerCard
              v-for="t in visible.urges"
              :key="t.id"
              :tracker="t"
              :rating="day.ratings[t.id]"
              :note="day.trackerNotes[t.id] ?? ''"
              @rate="emit('rate', t, $event)"
              @acted="emit('acted', t, $event)"
              @note="emit('tracker-note', t, $event)"
            />
          </div>
        </section>
      </div>

      <div class="pane side">
        <section>
          <h2 class="section-title">Medications</h2>
          <MedicationList
            :medications="visible.medications"
            :values="day.medications"
            @set="(m, v) => emit('medication', m, v)"
          />
        </section>

        <section class="notes">
          <h2 class="section-title"><label for="day-notes">Notes</label></h2>
          <textarea
            id="day-notes"
            v-autogrow
            class="card"
            rows="5"
            maxlength="20000"
            placeholder="How was today? Anything you want to remember or share…"
            :value="day.notes"
            @input="emit('notes', $event.target.value)"
          />
        </section>
      </div>

      <SkillsSection class="skills-row" :day="day" @toggle="(s, used) => emit('skill', s, used)" />
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

.empty {
  margin: 0;
}

.notes textarea {
  min-height: 140px;
  padding: 14px 16px;
}

/* Wide screens (MacBook): ratings on the left, medications and notes alongside. */
@container (min-width: 900px) {
  .sheet {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
    align-items: start;
  }
  .skills-row {
    grid-column: 1 / -1;
  }
}
</style>
