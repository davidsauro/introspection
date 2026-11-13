<script setup>
import { computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, onBeforeRouteLeave } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.js';
import { useDayStore } from '../stores/day.js';
import { addDays, currentDay } from '../utils/dates.js';
import DateNav from '../components/DateNav.vue';
import DaySheet from '../components/DaySheet.vue';
import StatsStrip from '../components/StatsStrip.vue';
import { useStatsStore } from '../stores/stats.js';
import AppIcon from '../components/AppIcon.vue';
import { online } from '../utils/online.js';

const props = defineProps({ date: { type: String, required: true } });

const router = useRouter();
const catalog = useCatalogStore();
const store = useDayStore();
const stats = useStatsStore();

// Shown while changes can't reach the server because of the connection (not for a refused save).
const connectionNotice = computed(() => {
  if (!store.unsaved || (online.value && store.problem !== 'network')) return '';
  const kept = store.keptOnDevice
    ? 'Your changes are kept on this device and will be saved'
    : 'Keep this page open: your changes will be saved';
  return online.value ? `Can't reach the diary right now. ${kept} once it's back.` : `You're offline. ${kept} when you reconnect.`;
});

const statusText = computed(() => {
  if (connectionNotice.value) return store.keptOnDevice ? 'Saved on this device' : 'Not saved yet';
  return (
    {
      pending: 'Saving…',
      saving: 'Saving…',
      saved: 'Saved',
      error: `Couldn't save: ${store.error}`,
    }[store.status] ?? ''
  );
});

function go(date) {
  router.push({ name: 'day', params: { date } });
}

watch(
  () => props.date,
  async (date, previous) => {
    await catalog.load();
    if (previous) await store.flush();
    await store.load(date);
  },
  { immediate: true }
);

// The summary boxes: on open, and after each save.
stats.refresh();
watch(
  () => store.status,
  (status) => status === 'saved' && stats.refresh()
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
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  const el = document.activeElement;
  if (el && (el.closest('input, textarea, select, [role="radiogroup"]') || el.isContentEditable)) return;
  if (e.key === 'ArrowLeft') go(addDays(props.date, -1));
  else if (e.key === 'ArrowRight' && props.date < currentDay.value) go(addDays(props.date, 1));
}

// Save straight away when the app is backgrounded or closed. (Changes are already on the
// device by then; this gets them to the server too, if it can.)
const flushOnClose = () => store.flush({ keepalive: true });
function onHide() {
  if (document.visibilityState === 'hidden') flushOnClose();
}

onMounted(() => {
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flushOnClose);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  document.removeEventListener('visibilitychange', onHide);
  window.removeEventListener('pagehide', flushOnClose);
});
onBeforeRouteLeave(() => store.flush());
</script>

<template>
  <div>
    <header class="day-header">
      <div class="day-row">
        <DateNav :date="date" @change="go" />
        <span class="spacer" />
        <span class="status small" :class="connectionNotice ? 'offline' : store.status" aria-live="polite">{{ statusText }}</span>
        <RouterLink class="btn" :to="{ name: 'export', query: { from: date, to: date } }" title="Share this day as a PDF">
          <AppIcon name="share" :size="18" />
          <span class="share-label">Share</span>
        </RouterLink>
      </div>
      <p v-if="connectionNotice" class="connection small" role="status">
        <AppIcon name="offline" :size="18" />
        <span>{{ connectionNotice }}</span>
      </p>
    </header>

    <StatsStrip />

    <p v-if="store.error && !store.day" class="error-text">{{ store.error }}</p>
    <DaySheet
      v-if="store.day?.date === date && catalog.loaded"
      :day="store.day"
      @rate="store.setRating"
      @acted="store.setActed"
      @medication="store.setMedication"
      @notes="store.setNotes"
      @tracker-note="store.setTrackerNote"
      @skill="store.setSkill"
      @period="store.setPeriod"
      @ovulating="store.setOvulating"
      @sleep="store.setSleep"
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
}

.day-row {
  position: relative; /* anchors the status on small phones */
  display: flex;
  align-items: center;
  gap: 12px;
}

/* In the sticky header, so it stays in view while she writes further down the page. */
.connection {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 10px 0 2px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--star) 45%, transparent);
  background: color-mix(in srgb, var(--star) 14%, var(--surface));
  color: var(--text);
}

.connection svg {
  flex: none;
  color: var(--star);
}

.status {
  color: var(--muted);
  white-space: nowrap;
}

.status.error {
  color: var(--danger);
}

.status.offline {
  color: var(--text);
  font-weight: 600;
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
  /* Too long to fit beside the date here, and the banner below says the same. */
  .status.offline {
    display: none;
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
