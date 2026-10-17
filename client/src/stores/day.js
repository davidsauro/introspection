import { defineStore } from 'pinia';
import { api } from '../api.js';

const SAVE_DELAY_MS = 800;

// Server shape → editable shape keyed by id.
export function normalizeDay(raw) {
  return {
    date: raw.date,
    notes: raw.notes ?? '',
    ratings: Object.fromEntries(
      raw.ratings.map((r) => [r.trackerId, { value: r.value, scaleMax: r.scaleMax, actedOn: r.actedOn }])
    ),
    medications: Object.fromEntries(raw.medications.map((m) => [m.medicationId, m.taken])),
  };
}

export function isEmptyDay(day) {
  return !day || (!day.notes?.trim() && !Object.keys(day.ratings).length && !Object.keys(day.medications).length);
}

let timer = null;
let inflight = null;
// Unsaved changes per date, so a retried save always lands on the day it was made for.
const pendingByDate = new Map();

function pendingFor(date) {
  if (!pendingByDate.has(date)) {
    pendingByDate.set(date, { notes: undefined, ratings: new Map(), medications: new Map() });
  }
  return pendingByDate.get(date);
}

export const useDayStore = defineStore('day', {
  state: () => ({
    date: null,
    day: null,
    loading: false,
    // 'idle' | 'pending' | 'saving' | 'saved' | 'error'
    status: 'idle',
    error: null,
  }),
  actions: {
    async load(date) {
      await this.flush();
      this.date = date;
      this.loading = true;
      this.error = null;
      try {
        const raw = await api.get(`/days/${date}`);
        if (this.date === date) this.day = normalizeDay(raw);
        this.status = 'idle';
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },

    setRating(tracker, value) {
      if (value === null) {
        delete this.day.ratings[tracker.id];
      } else {
        // Re-rating an existing entry keeps the scale it was recorded on (the card shows that scale).
        const prev = this.day.ratings[tracker.id];
        this.day.ratings[tracker.id] = {
          value,
          scaleMax: prev?.scaleMax ?? tracker.scaleMax,
          actedOn: prev?.actedOn ?? null,
        };
      }
      this.queueRating(tracker.id);
    },

    setActed(tracker, actedOn) {
      const r = this.day.ratings[tracker.id];
      if (!r) return;
      r.actedOn = actedOn;
      this.queueRating(tracker.id);
    },

    setMedication(med, taken) {
      if (taken === null) delete this.day.medications[med.id];
      else this.day.medications[med.id] = taken;
      pendingFor(this.date).medications.set(med.id, { medicationId: med.id, taken });
      this.schedule();
    },

    setNotes(text) {
      this.day.notes = text;
      pendingFor(this.date).notes = text;
      this.schedule();
    },

    queueRating(trackerId) {
      const r = this.day.ratings[trackerId];
      pendingFor(this.date).ratings.set(
        trackerId,
        r ? { trackerId, value: r.value, scaleMax: r.scaleMax, actedOn: r.actedOn } : { trackerId, value: null }
      );
      this.schedule();
    },

    schedule() {
      this.status = 'pending';
      clearTimeout(timer);
      timer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
    },

    // Sends all queued changes now. Safe to call repeatedly.
    async flush() {
      clearTimeout(timer);
      if (inflight) await inflight;
      if (!pendingByDate.size) return;

      const batches = [...pendingByDate.entries()];
      pendingByDate.clear();
      this.status = 'saving';

      inflight = Promise.all(
        batches.map(([date, p]) => {
          const body = {
            ...(p.notes !== undefined && { notes: p.notes }),
            ratings: [...p.ratings.values()],
            medications: [...p.medications.values()],
          };
          return api.put(`/days/${date}`, body).catch((e) => {
            // The server rejected the data itself; resending it would fail the same way forever.
            if (e.status >= 400 && e.status < 500 && e.status !== 401) throw e;
            // Otherwise (offline, server down, logged out) put the changes back, unless newer
            // edits replaced them, so the next save retries.
            const again = pendingFor(date);
            if (p.notes !== undefined && again.notes === undefined) again.notes = p.notes;
            for (const [k, v] of p.ratings) if (!again.ratings.has(k)) again.ratings.set(k, v);
            for (const [k, v] of p.medications) if (!again.medications.has(k)) again.medications.set(k, v);
            throw e;
          });
        })
      )
        .then(() => {
          if (this.status === 'saving') this.status = 'saved';
        })
        .catch((e) => {
          this.status = 'error';
          this.error = e.message;
        })
        .finally(() => (inflight = null));
      await inflight;
    },
  },
});
