import { defineStore } from 'pinia';
import { api } from '../api.js';
import { today } from '../utils/dates.js';

// The three summary boxes on the Day screen (see server/src/routes/stats.js).
export const useStatsStore = defineStore('stats', {
  state: () => ({ streak: null, skillsUsed: null, totalEntries: null }),
  actions: {
    async refresh() {
      try {
        Object.assign(this, await api.get(`/stats?today=${today()}`));
      } catch {
        // Not worth interrupting her for; the boxes just keep their last values.
      }
    },
  },
});
