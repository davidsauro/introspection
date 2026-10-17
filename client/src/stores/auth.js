import { defineStore } from 'pinia';
import { api } from '../api.js';

export const useAuthStore = defineStore('auth', {
  state: () => ({ loaded: false, setupRequired: false, authenticated: false }),
  actions: {
    async refresh() {
      const s = await api.get('/auth/status');
      this.setupRequired = s.setupRequired;
      this.authenticated = s.authenticated;
      this.loaded = true;
    },
    async setup(password) {
      await api.post('/auth/setup', { password });
      this.setupRequired = false;
      this.authenticated = true;
    },
    async login(password) {
      await api.post('/auth/login', { password });
      this.authenticated = true;
    },
    async logout() {
      await api.post('/auth/logout');
      this.authenticated = false;
    },
    changePassword(currentPassword, newPassword) {
      return api.post('/auth/password', { currentPassword, newPassword });
    },
  },
});
