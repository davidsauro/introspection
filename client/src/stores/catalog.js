import { defineStore } from 'pinia';
import { api } from '../api.js';
import { compareSkills } from '../utils/skills.js';

// Swaps an item with its neighbour among `list` (already in display order) and saves the new order.
async function move(list, item, delta, url) {
  const ordered = [...list];
  const i = ordered.indexOf(item);
  const j = i + delta;
  if (j < 0 || j >= ordered.length) return;
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  ordered.forEach((x, k) => (x.sortOrder = k));
  await api.put(url, ordered.map((x) => x.id));
}

// The configurable lists: emotions, urges, medications and skills (archived ones included,
// because past days and reports still need their names).
export const useCatalogStore = defineStore('catalog', {
  state: () => ({ trackers: [], medications: [], skills: [], loaded: false }),
  getters: {
    emotions: (s) => s.trackers.filter((t) => t.kind === 'emotion'),
    urges: (s) => s.trackers.filter((t) => t.kind === 'urge'),
    trackerById: (s) => (id) => s.trackers.find((t) => t.id === id),
  },
  actions: {
    async load(force = false) {
      if (this.loaded && !force) return;
      const [trackers, medications] = await Promise.all([
        api.get('/trackers?includeArchived=true'),
        api.get('/medications?includeArchived=true'),
        this.refreshSkills(),
      ]);
      this.trackers = trackers.sort((a, b) => a.sortOrder - b.sortOrder);
      this.medications = medications.sort((a, b) => a.sortOrder - b.sortOrder);
      this.loaded = true;
    },
    // Skills carry lastUsed (for the Recent list), which changes as she ticks them.
    async refreshSkills() {
      this.skills = (await api.get('/skills?includeArchived=true')).sort(compareSkills);
    },
    async addTracker(data) {
      this.trackers.push(await api.post('/trackers', data));
    },
    async updateTracker(id, patch) {
      const updated = await api.patch(`/trackers/${id}`, patch);
      Object.assign(this.trackers.find((t) => t.id === id), updated);
    },
    async moveTracker(id, delta) {
      const t = this.trackers.find((x) => x.id === id);
      const siblings = this.trackers.filter((x) => x.kind === t.kind && !x.archived);
      await move(siblings, t, delta, '/trackers/order');
      this.trackers.sort((a, b) => a.sortOrder - b.sortOrder);
    },
    async addMedication(data) {
      this.medications.push(await api.post('/medications', data));
    },
    async updateMedication(id, patch) {
      const updated = await api.patch(`/medications/${id}`, patch);
      Object.assign(this.medications.find((m) => m.id === id), updated);
    },
    async moveMedication(id, delta) {
      const m = this.medications.find((x) => x.id === id);
      await move(this.medications.filter((x) => !x.archived), m, delta, '/medications/order');
      this.medications.sort((a, b) => a.sortOrder - b.sortOrder);
    },
    async addSkill(data) {
      this.skills.push(await api.post('/skills', data));
      this.skills.sort(compareSkills);
    },
    async updateSkill(id, patch) {
      const updated = await api.patch(`/skills/${id}`, patch);
      Object.assign(this.skills.find((s) => s.id === id), updated);
      this.skills.sort(compareSkills);
    },
    async moveSkill(id, delta) {
      const s = this.skills.find((x) => x.id === id);
      await move(this.skills.filter((x) => x.module === s.module && !x.archived), s, delta, '/skills/order');
      this.skills.sort(compareSkills);
    },
  },
});
