import { defineStore } from 'pinia';
import { api } from '../api.js';
import { readUnsaved, writeUnsaved, clearUnsaved } from '../utils/unsaved.js';

const SAVE_DELAY_MS = 800;
// After a failed save (offline, server down), try again after these pauses, then every minute.
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];
const TEXT_LIMITS = { notes: 20000, trackerNote: 5000 }; // as the server and the textareas allow
const RECOVERED_MARKER = '— Recovered from this device —';

// Server shape → editable shape keyed by id.
export function normalizeDay(raw) {
  return {
    date: raw.date,
    notes: raw.notes ?? '',
    ratings: Object.fromEntries(
      raw.ratings.map((r) => [r.trackerId, { value: r.value, scaleMax: r.scaleMax, actedOn: r.actedOn }])
    ),
    medications: Object.fromEntries(raw.medications.map((m) => [m.medicationId, m.taken])),
    trackerNotes: Object.fromEntries((raw.trackerNotes ?? []).map((n) => [n.trackerId, n.note])),
    skills: Object.fromEntries((raw.skills ?? []).map((id) => [id, true])),
    period: raw.period ?? null, // null, or { flow: 'light' | 'medium' | 'heavy' | null }
    ovulating: !!raw.ovulating,
    sleep: raw.sleep ?? null, // null, or { hours: number | null, fellAsleepQuickly, stayedAsleep }
  };
}

export function isEmptyDay(day) {
  return (
    !day ||
    (!day.notes?.trim() &&
      !Object.keys(day.ratings).length &&
      !Object.keys(day.medications).length &&
      !Object.values(day.trackerNotes ?? {}).some((n) => n.trim()) &&
      !Object.keys(day.skills ?? {}).length &&
      !day.period &&
      !day.ovulating &&
      !day.sleep)
  );
}

/*
 * Each change is queued under a key naming the one thing it changes: 'notes', 'period',
 * 'ovulating', 'sleep', or 'rating:<trackerId>', 'medication:<id>', 'trackerNote:<trackerId>',
 * 'skill:<id>'. Its value is in the shape PUT /api/days/:date takes, read from a day by fieldOf.
 */
const LISTS = { rating: 'ratings', medication: 'medications', trackerNote: 'trackerNotes', skill: 'skills' };

export function fieldOf(day, key) {
  const [kind, rawId] = key.split(':');
  const id = Number(rawId);
  switch (kind) {
    case 'rating': {
      const r = day.ratings[id];
      return r ? { trackerId: id, value: r.value, scaleMax: r.scaleMax, actedOn: r.actedOn ?? null } : { trackerId: id, value: null };
    }
    case 'medication':
      return { medicationId: id, taken: day.medications[id] ?? null };
    case 'trackerNote': {
      const text = day.trackerNotes[id] ?? '';
      return { trackerId: id, note: text.trim() ? text : null };
    }
    case 'skill':
      return { skillId: id, used: !!day.skills[id] };
    default:
      return day[kind]; // notes, period, ovulating, sleep
  }
}

// The reverse of fieldOf: puts a queued value back on a day (used to show restored changes).
export function applyField(day, key, value) {
  const [kind, rawId] = key.split(':');
  const id = Number(rawId);
  switch (kind) {
    case 'rating':
      if (value.value === null) delete day.ratings[id];
      else day.ratings[id] = { value: value.value, scaleMax: value.scaleMax, actedOn: value.actedOn ?? null };
      break;
    case 'medication':
      if (value.taken === null) delete day.medications[id];
      else day.medications[id] = value.taken;
      break;
    case 'trackerNote':
      if (value.note === null) delete day.trackerNotes[id];
      else day.trackerNotes[id] = value.note;
      break;
    case 'skill':
      if (value.used) day.skills[id] = true;
      else delete day.skills[id];
      break;
    default:
      day[kind] = value;
  }
}

function bodyOf(entries) {
  const body = { ratings: [], medications: [], trackerNotes: [], skills: [] };
  for (const [key, { value }] of entries) {
    const kind = key.split(':')[0];
    if (LISTS[kind]) body[LISTS[kind]].push(value);
    else body[kind] = value;
  }
  return body;
}

// Plain copy: drops Vue's reactive proxies, and keeps later edits from changing queued values.
const plain = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function same(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => same(a[k], b[k]));
}

const textOf = (key, value) => (key === 'notes' ? value : value.note) ?? '';
const withText = (key, value, text) => (key === 'notes' ? text : { ...value, note: text.trim() ? text : null });

/*
 * Changes restored from the device may be stale: they could have reached the server before the
 * page closed, or the day may have been edited on another device since. Checks each one against
 * the server's current day (mutating entries):
 *   - the server already has it → drop it;
 *   - the server still has what she started from → keep it, to send;
 *   - changed elsewhere since → the server's version wins, except for text, where hers is
 *     added below the server's (unless the server's already contains it) so no writing is lost.
 */
export function reconcile(entries, serverDay) {
  for (const [key, entry] of entries) {
    const now = fieldOf(serverDay, key);
    if (same(now, entry.value)) {
      entries.delete(key);
    } else if (same(now, entry.base)) {
      continue;
    } else if (key === 'notes' || key.startsWith('trackerNote:')) {
      const theirs = textOf(key, now);
      const mine = textOf(key, entry.value).trim();
      if (!mine || theirs.includes(mine)) {
        entries.delete(key);
        continue;
      }
      const merged = theirs.trim() ? `${theirs.trimEnd()}\n\n${RECOVERED_MARKER}\n${mine}` : mine;
      const limit = TEXT_LIMITS[key.split(':')[0]];
      entries.set(key, { value: withText(key, entry.value, merged.slice(0, limit)), base: now });
    } else {
      entries.delete(key);
    }
  }
}

// Module-level so changes outlive the Day screen. Each is date → Map(key → { value, base }).
const pending = new Map(); // not sent yet
const sending = new Map(); // sent, waiting for the server to confirm
const unverified = new Set(); // dates whose restored changes haven't been checked against the server
let restored = false;
let timer = null;
let retryTimer = null;
let retries = 0;
let inflight = null;
let generation = 0; // bumped by forget(), so a save still in flight at logout can't re-store its changes

function entriesFor(map, date) {
  if (!map.has(date)) map.set(date, new Map());
  return map.get(date);
}

const unconfirmed = (date, key) => pending.get(date)?.get(key) ?? sending.get(date)?.get(key);

// 'rejected': the server refused the data, so resending can't help. 'auth': logged out.
// 'network': offline, timed out, or the server is down; worth retrying.
function problemOf(e) {
  if (e.status === 401) return 'auth';
  if (e.status >= 400 && e.status < 500) return 'rejected';
  return 'network';
}

export const useDayStore = defineStore('day', {
  state: () => ({
    date: null,
    day: null,
    loading: false,
    // 'idle' | 'pending' | 'saving' | 'saved' | 'error'
    status: 'idle',
    error: null,
    // Why the last save failed ('network' | 'auth' | 'rejected'), until a save succeeds.
    problem: null,
    // Whether any change hasn't been confirmed by the server yet.
    unsaved: false,
    // Whether those changes are also stored on the device (false if storage is blocked or full).
    keptOnDevice: true,
  }),
  actions: {
    // Picks up changes left on this device by an earlier visit. Safe to call repeatedly.
    restore() {
      if (restored) return;
      restored = true;
      for (const [date, entries] of readUnsaved()) {
        const mine = entriesFor(pending, date);
        for (const [key, entry] of entries) if (!mine.has(key)) mine.set(key, entry);
        unverified.add(date);
      }
      this.unsaved = pending.size > 0;
    },

    async load(date) {
      this.restore();
      await this.flush();
      this.date = date;
      this.loading = true;
      this.error = null;
      try {
        const raw = await api.get(`/days/${date}`);
        if (this.date !== date) return;
        const day = normalizeDay(raw);
        // Show changes that haven't reached the server (restored, or from a failed save).
        const mine = pending.get(date);
        if (mine) {
          if (unverified.delete(date)) {
            reconcile(mine, day);
            if (!mine.size) pending.delete(date);
            this.persist(date);
          }
          for (const [key, { value }] of mine) applyField(day, key, plain(value));
        }
        this.day = day;
        if (!pending.has(date)) this.status = 'idle';
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },

    // Applies one change to the day on screen and queues it for the server.
    change(key, apply) {
      const date = this.date;
      const earlier = unconfirmed(date, key);
      const base = earlier ? earlier.base : plain(fieldOf(this.day, key));
      apply(this.day);
      entriesFor(pending, date).set(key, { value: plain(fieldOf(this.day, key)), base });
      this.persist(date);
      this.schedule();
    },

    setRating(tracker, value) {
      this.change(`rating:${tracker.id}`, (day) => {
        if (value === null) {
          delete day.ratings[tracker.id];
        } else {
          // Re-rating an existing entry keeps the scale it was recorded on (the card shows that scale).
          const prev = day.ratings[tracker.id];
          day.ratings[tracker.id] = {
            value,
            scaleMax: prev?.scaleMax ?? tracker.scaleMax,
            actedOn: prev?.actedOn ?? null,
          };
        }
      });
    },

    setActed(tracker, actedOn) {
      if (!this.day.ratings[tracker.id]) return;
      this.change(`rating:${tracker.id}`, (day) => (day.ratings[tracker.id].actedOn = actedOn));
    },

    setMedication(med, taken) {
      this.change(`medication:${med.id}`, (day) => {
        if (taken === null) delete day.medications[med.id];
        else day.medications[med.id] = taken;
      });
    },

    setNotes(text) {
      this.change('notes', (day) => (day.notes = text));
    },

    // null means no bleeding that day; otherwise { flow }.
    setPeriod(period) {
      this.change('period', (day) => (day.period = period));
    },

    setOvulating(ovulating) {
      this.change('ovulating', (day) => (day.ovulating = ovulating));
    },

    // The whole night at once; nothing entered or ticked is saved as no sleep entry.
    setSleep(sleep) {
      const empty = sleep.hours === null && !sleep.fellAsleepQuickly && !sleep.stayedAsleep;
      this.change('sleep', (day) => (day.sleep = empty ? null : sleep));
    },

    setSkill(skill, used) {
      this.change(`skill:${skill.id}`, (day) => {
        if (used) day.skills[skill.id] = true;
        else delete day.skills[skill.id];
      });
    },

    // The note under one emotion/urge card. Kept exactly as typed on screen (so a leading
    // newline or space isn't swallowed); blank text deletes it on the server.
    setTrackerNote(tracker, text) {
      this.change(`trackerNote:${tracker.id}`, (day) => (day.trackerNotes[tracker.id] = text));
    },

    // Writes a day's unconfirmed changes (sent or not) to the device, straight away, so a
    // refresh or a closed tab can't lose them. Cleared once the server confirms.
    persist(date) {
      const all = new Map(sending.get(date));
      for (const [key, entry] of pending.get(date) ?? []) all.set(key, entry);
      this.keptOnDevice = writeUnsaved(date, all) || !all.size;
      this.unsaved = pending.size > 0 || sending.size > 0;
    },

    schedule() {
      this.status = 'pending';
      clearTimeout(timer);
      timer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
    },

    // Sends all queued changes now. Safe to call repeatedly. keepalive lets a save started as
    // the page closes finish, but browsers cap it at 64 KB, so only page-close saves use it.
    async flush({ keepalive = false } = {}) {
      clearTimeout(timer);
      if (inflight) await inflight;
      if (!pending.size) return;
      clearTimeout(retryTimer);

      const batches = [...pending.entries()];
      pending.clear();
      for (const [date, entries] of batches) sending.set(date, entries);
      this.status = 'saving';

      inflight = Promise.allSettled(batches.map(([date, entries]) => this.send(date, entries, keepalive)))
        .then((results) => {
          const failed = results.find((r) => r.status === 'rejected');
          if (!failed) {
            if (this.status === 'saving') this.status = 'saved';
            this.problem = null;
            retries = 0;
            return;
          }
          this.status = 'error';
          this.error = failed.reason.message;
          this.problem = problemOf(failed.reason);
          if (this.problem === 'network') {
            retryTimer = setTimeout(() => this.flush(), RETRY_DELAYS_MS[Math.min(retries++, RETRY_DELAYS_MS.length - 1)]);
          }
        })
        .finally(() => (inflight = null));
      await inflight;
    },

    async send(date, entries, keepalive) {
      const keys = [...entries.keys()]; // before reconcile drops any
      const gen = generation;
      let serverDay = null;
      try {
        if (unverified.has(date)) {
          serverDay = normalizeDay(await api.get(`/days/${date}`));
          reconcile(entries, serverDay);
          unverified.delete(date);
        }
        if (entries.size) {
          const url = `/days/${date}`;
          await (keepalive ? api.put(url, bodyOf(entries), { keepalive: true }) : api.put(url, bodyOf(entries)));
        }
        if (gen !== generation) return;
        sending.delete(date);
        // Edits made while this was in flight were made on top of what the server now has:
        // what was sent, or for entries reconcile dropped, what the server already had.
        const newer = pending.get(date);
        for (const key of keys) {
          if (!newer?.has(key)) continue;
          newer.get(key).base = entries.has(key) ? entries.get(key).value : plain(fieldOf(serverDay, key));
        }
        this.persist(date);
      } catch (e) {
        if (gen !== generation) return;
        sending.delete(date);
        // Unless the server refused the data itself (resending would fail the same way forever),
        // put the changes back so they're retried, except where newer edits replaced them.
        if (problemOf(e) !== 'rejected') {
          const again = entriesFor(pending, date);
          for (const [key, entry] of entries) if (!again.has(key)) again.set(key, entry);
        }
        if (!pending.get(date)?.size) pending.delete(date);
        this.persist(date);
        throw e;
      }
    },

    // On logout: drop every unsaved change, here and on the device.
    forget() {
      generation++;
      clearTimeout(timer);
      clearTimeout(retryTimer);
      pending.clear();
      sending.clear();
      unverified.clear();
      clearUnsaved();
      this.unsaved = false;
      this.problem = null;
      this.status = 'idle';
    },
  },
});
