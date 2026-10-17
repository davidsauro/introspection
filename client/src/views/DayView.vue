<script setup>
import { computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, onBeforeRouteLeave } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.js';
import { useDayStore } from '../stores/day.js';
import { addDays, currentDay } from '../utils/dates.js';
import DateNav from '../components/DateNav.vue';
import DaySheet from '../components/DaySheet.vue';
import AppIcon from '../components/AppIcon.vue';

const props = defineProps({ date: { type: String, required: true } });

const router = useRouter();
const catalog = useCatalogStore();
const store = useDayStore();

const statusText = computed(
  () =>
    ({
      pending: 'Saving…',
      saving: 'Saving…',
      saved: 'Saved',
      error: `Couldn't save: ${store.error}`,
    })[store.status] ?? ''
);

function go(date) {
  router.push({ name: 'day', params: { date } });
}

watch(
  () => props.date,
  async (date) => {
    await catalog.load();
    await store.load(date);
  },
  { immediate: true }
);

// If she was on "today" when the date rolled over (e.g. reopening the app next morning),
// move to the new today rather than leaving her on yesterday.
// Not while she's typing, though: writing notes across midnight shouldn't whisk the page away.
watch(currentDay, (now, before) => {
  const typing = document.activeElement?.matches('textarea, input');
  if (props.date === before && !typing) go(now);
});

// ←/→ change day on a keyboard, unless she's typing or using a rating scale.
function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const el = document.activeElement;
  if (el && (el.closest('input, textarea, select, [role="radiogroup"]') || el.isContentEditable)) return;
  if (e.key === 'ArrowLeft') go(addDays(props.date, -1));
  else if (e.key === 'ArrowRight' && props.date < currentDay.value) go(addDays(props.date, 1));
}

// Save straight away when the app is backgrounded or closed.
function onHide() {
  if (document.visibilityState === 'hidden') store.flush();
}

onMounted(() => {
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', store.flush);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  document.removeEventListener('visibilitychange', onHide);
  window.removeEventListener('pagehide', store.flush);
});
onBeforeRouteLeave(() => store.flush());
</script>

<template>
  <div>
    <header class="page-header day-header">
      <DateNav :date="date" @change="go" />
      <span class="spacer" />
      <span class="status small" :class="store.status" aria-live="polite">{{ statusText }}</span>
      <RouterLink class="btn" :to="{ name: 'export', query: { from: date, to: date } }" title="Share this day as a PDF">
        <AppIcon name="share" :size="18" />
        <span class="share-label">Share</span>
      </RouterLink>
    </header>

    <p v-if="store.error && !store.day" class="error-text">{{ store.error }}</p>
    <DaySheet
      v-if="store.day?.date === date && catalog.loaded"
      :day="store.day"
      @rate="store.setRating"
      @acted="store.setActed"
      @medication="store.setMedication"
      @notes="store.setNotes"
      @tracker-note="store.setTrackerNote"
    />
  </div>
</template>

<style scoped>
.day-header {
  position: sticky;
  top: env(safe-area-inset-top);
  z-index: 10;
  margin: -16px -16px 16px;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  flex-wrap: nowrap;
}

.status {
  color: var(--muted);
  white-space: nowrap;
}

.status.error {
  color: var(--danger);
}

.share-label {
  display: none;
}

@media (max-width: 420px) {
  .status {
    position: absolute;
    right: 72px;
    bottom: -4px;
    font-size: 0.72rem;
  }
}

@media (min-width: 640px) {
  .day-header {
    top: 61px; /* below the top nav bar */
    margin: -24px -24px 16px;
    padding: 12px 24px;
  }
  .share-label {
    display: inline;
  }
}

@media (min-width: 1024px) {
  .day-header {
    top: 0;
    margin: -32px -40px 20px;
    padding: 16px 40px;
  }
}
</style>
