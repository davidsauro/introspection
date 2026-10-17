import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth.js';
import { setUnauthorizedHandler } from './api.js';
import { today, isValidDate } from './utils/dates.js';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: () => `/day/${today()}` },
    { path: '/day/:date', name: 'day', component: () => import('./views/DayView.vue'), props: true },
    { path: '/history', name: 'history', component: () => import('./views/HistoryView.vue') },
    { path: '/export', name: 'export', component: () => import('./views/ExportView.vue') },
    { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
    { path: '/login', name: 'login', component: () => import('./views/LoginView.vue'), meta: { public: true, bare: true } },
    { path: '/print', name: 'print', component: () => import('./views/PrintReportView.vue'), meta: { bare: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.loaded) await auth.refresh();
  if (to.meta.public) {
    return auth.authenticated ? '/' : true;
  }
  if (!auth.authenticated) {
    return { name: 'login', query: to.fullPath !== '/' ? { next: to.fullPath } : {} };
  }
  if (to.name === 'day' && !isValidDate(to.params.date)) return `/day/${today()}`;
  return true;
});

setUnauthorizedHandler(() => {
  const auth = useAuthStore();
  auth.authenticated = false;
  const current = router.currentRoute.value;
  if (current.name === 'print') {
    window.__REPORT_ERROR__ = 'Not logged in';
  } else if (!current.meta.public) {
    router.replace({ name: 'login', query: { next: current.fullPath } });
  }
});

export default router;
