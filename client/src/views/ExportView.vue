<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { generatePdf } from '../pdf/generate.js';
import { addDays, daysBetween, formatRange, isValidDate, today } from '../utils/dates.js';
import AppIcon from '../components/AppIcon.vue';

const MAX_DAYS = 92;

const route = useRoute();
const from = ref(isValidDate(route.query.from) ? route.query.from : addDays(today(), -6));
const to = ref(isValidDate(route.query.to) ? route.query.to : today());

const presets = [
  { label: 'Today', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
];

function applyPreset(days) {
  to.value = today();
  from.value = addDays(today(), -(days - 1));
}

const activePreset = computed(() =>
  to.value === today() ? presets.find((p) => from.value === addDays(today(), -(p.days - 1)))?.days : null
);

const datesValid = computed(() => isValidDate(from.value) && isValidDate(to.value));
const dayCount = computed(() => (datesValid.value ? daysBetween(from.value, to.value) + 1 : 0));
const rangeError = computed(() => {
  if (!datesValid.value) return 'Choose a start and end date.';
  if (dayCount.value < 1) return 'The start date must be on or before the end date.';
  if (dayCount.value > MAX_DAYS) return `A PDF can cover up to ${MAX_DAYS} days.`;
  return '';
});

const busy = ref(false);
const error = ref('');
const file = ref(null);
const fileUrl = ref(null);

const canShare = computed(() => !!file.value && !!navigator.canShare?.({ files: [file.value] }));

function clearFile() {
  if (fileUrl.value) URL.revokeObjectURL(fileUrl.value);
  file.value = fileUrl.value = null;
}

// A new range invalidates the PDF already made.
watch([from, to], clearFile);
onBeforeUnmount(clearFile);

async function generate() {
  if (rangeError.value) return;
  busy.value = true;
  error.value = '';
  clearFile();
  try {
    file.value = await generatePdf(from.value, to.value);
    fileUrl.value = URL.createObjectURL(file.value);
  } catch (e) {
    console.error(e);
    error.value = `Couldn't create the PDF: ${e.message}`;
  } finally {
    busy.value = false;
  }
}

async function share() {
  try {
    await navigator.share({ files: [file.value], title: file.value.name });
  } catch (e) {
    if (e.name !== 'AbortError') error.value = e.message;
  }
}
</script>

<template>
  <div class="export">
    <header class="page-header">
      <h1>Export PDF</h1>
    </header>
    <p class="muted intro">
      Create a PDF to share with your therapist. It shows the same ratings, medications and notes as the day screen.
      A longer range starts with a summary and charts, followed by every day. The PDF is made on this device.
    </p>

    <div class="card stack panel">
      <div class="presets" role="group" aria-label="Quick ranges">
        <button
          v-for="p in presets"
          :key="p.days"
          type="button"
          class="btn"
          :class="{ primary: activePreset === p.days }"
          @click="applyPreset(p.days)"
        >
          {{ p.label }}
        </button>
      </div>

      <div class="dates">
        <label class="field">
          From
          <input v-model="from" type="date" :max="today()" />
        </label>
        <label class="field">
          To
          <input v-model="to" type="date" :max="today()" />
        </label>
      </div>

      <p v-if="rangeError" class="error-text">{{ rangeError }}</p>
      <p v-else class="muted small summary">
        {{ formatRange(from, to) }} · {{ dayCount }} {{ dayCount === 1 ? 'day' : 'days' }}
      </p>

      <button class="btn primary big" type="button" :disabled="!!rangeError || busy" @click="generate">
        {{ busy ? 'Creating PDF…' : 'Create PDF' }}
      </button>

      <p v-if="error" class="error-text" role="alert">{{ error }}</p>

      <div v-if="file" class="ready" role="status">
        <p><AppIcon name="check" :size="18" /> {{ file.name }} is ready.</p>
        <div class="row">
          <button v-if="canShare" class="btn primary" type="button" @click="share">
            <AppIcon name="share" :size="18" /> Share
          </button>
          <a class="btn" :href="fileUrl" :download="file.name"><AppIcon name="export" :size="18" /> Download</a>
          <a class="btn ghost" :href="fileUrl" target="_blank" rel="noopener">Open</a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.export {
  max-width: 640px;
}

.intro {
  margin: 0 0 16px;
}

.panel {
  gap: 16px;
}

.panel p {
  margin: 0;
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dates {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.big {
  min-height: 52px;
  font-size: 1.05rem;
}

.ready {
  display: grid;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.ready p {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 550;
}
</style>
