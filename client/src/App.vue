<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppIcon from './components/AppIcon.vue';
import { today } from './utils/dates.js';

const route = useRoute();
const bare = computed(() => route.meta.bare);

const links = computed(() => [
  { to: `/day/${today()}`, label: 'Day', icon: 'day', active: route.name === 'day' },
  { to: '/history', label: 'History', icon: 'history', active: route.name === 'history' },
  { to: '/export', label: 'Export', icon: 'export', active: route.name === 'export' },
  { to: '/settings', label: 'Settings', icon: 'settings', active: route.name === 'settings' },
]);
</script>

<template>
  <RouterView v-if="bare" />
  <div v-else class="shell">
    <nav class="nav no-print" aria-label="Main">
      <div class="brand">
        <img src="/icon.svg" alt="" width="28" height="28" />
        <span>Diary</span>
      </div>
      <RouterLink
        v-for="l in links"
        :key="l.label"
        :to="l.to"
        class="nav-link"
        :class="{ active: l.active }"
        :aria-current="l.active ? 'page' : undefined"
      >
        <AppIcon :name="l.icon" />
        <span>{{ l.label }}</span>
      </RouterLink>
    </nav>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
/* Phone: content above a fixed bottom tab bar. */
.shell {
  min-height: 100dvh;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left);
}

.content {
  padding: 16px 16px calc(var(--nav-h) + env(safe-area-inset-bottom) + 24px);
  max-width: 1200px;
  margin: 0 auto;
}

.nav {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  height: calc(var(--nav-h) + env(safe-area-inset-bottom));
  padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--border);
}

.brand {
  display: none;
}

.nav-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--muted);
  text-decoration: none;
  font-size: 0.72rem;
  font-weight: 550;
}

.nav-link.active {
  color: var(--accent);
}

/* Tablet portrait / small window: horizontal bar across the top. */
@media (min-width: 640px) {
  .nav {
    position: sticky;
    top: 0;
    inset: auto;
    display: flex;
    align-items: center;
    gap: 4px;
    height: auto;
    padding: 8px max(16px, env(safe-area-inset-right)) 8px max(16px, env(safe-area-inset-left));
    border-top: 0;
    border-bottom: 1px solid var(--border);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 650;
    margin-right: auto;
  }
  .nav-link {
    flex-direction: row;
    gap: 8px;
    font-size: 0.95rem;
    min-height: var(--tap);
    padding: 0 14px;
    border-radius: var(--radius-sm);
  }
  .nav-link.active {
    background: var(--surface-2);
  }
  .content {
    padding: 24px 24px calc(env(safe-area-inset-bottom) + 32px);
  }
}

/* iPad landscape / MacBook: left sidebar. */
@media (min-width: 1024px) {
  .shell {
    display: grid;
    grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
  }
  .nav {
    position: sticky;
    top: 0;
    height: 100dvh;
    flex-direction: column;
    align-items: stretch;
    padding: 20px 12px;
    border-bottom: 0;
    border-right: 1px solid var(--border);
  }
  .brand {
    margin: 0 0 16px 8px;
  }
  .nav-link {
    justify-content: flex-start;
  }
  .content {
    width: 100%;
    padding: 32px 40px 48px;
  }
}

@media (hover: hover) {
  .nav-link:not(.active):hover {
    color: var(--text);
  }
}
</style>
