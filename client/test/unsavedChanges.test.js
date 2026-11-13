import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Changes kept on the device (localStorage) until the server confirms them, so a lost connection
// followed by a refresh, a closed tab or iOS unloading the app doesn't lose any writing.

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../src/api.js', () => ({ api }));

class MemoryStorage {
  map = new Map();
  get length() {
    return this.map.size;
  }
  key(i) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
}

const D = '2026-03-01';
const sadness = { id: 1, kind: 'emotion', scaleMax: 5, trackActed: false };
const offline = () => new TypeError('Failed to fetch');

let storage;
let server; // date → raw day, as GET /api/days/:date returns it

const rawDay = (date) =>
  server.get(date) ?? { date, notes: '', ratings: [], medications: [], trackerNotes: [], skills: [] };
const stored = (date) => JSON.parse(storage.getItem(`diary:unsaved:${date}`))?.entries ?? null;
const seed = (date, entries) => storage.setItem(`diary:unsaved:${date}`, JSON.stringify({ v: 1, entries }));

// A minimal server: applies notes, card notes and ratings like PUT /api/days/:date.
async function put(url, body) {
  const date = url.split('/').pop();
  const day = structuredClone(rawDay(date));
  if (body.notes !== undefined) day.notes = body.notes;
  for (const n of body.trackerNotes) {
    day.trackerNotes = day.trackerNotes.filter((x) => x.trackerId !== n.trackerId);
    if (n.note?.trim()) day.trackerNotes.push(n);
  }
  for (const r of body.ratings) {
    day.ratings = day.ratings.filter((x) => x.trackerId !== r.trackerId);
    if (r.value !== null) day.ratings.push(r);
  }
  server.set(date, day);
  return {};
}

// A fresh page load: new module state, new Pinia, same device storage.
async function openApp() {
  vi.resetModules();
  const { useDayStore } = await import('../src/stores/day.js');
  setActivePinia(createPinia());
  return useDayStore();
}

beforeEach(() => {
  vi.useFakeTimers();
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  server = new Map();
  api.get.mockReset().mockImplementation(async (url) => structuredClone(rawDay(url.split('/').pop())));
  api.put.mockReset().mockImplementation(put);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('keeping changes on the device', () => {
  it('stores each change straight away, and clears it once the server confirms', async () => {
    const store = await openApp();
    await store.load(D);
    store.setNotes('dear diary');
    expect(stored(D).notes.value).toBe('dear diary'); // before the autosave delay
    expect(store.unsaved).toBe(true);
    expect(store.keptOnDevice).toBe(true);

    await store.flush();
    expect(storage.getItem(`diary:unsaved:${D}`)).toBeNull();
    expect(store.unsaved).toBe(false);
    expect(server.get(D).notes).toBe('dear diary');
  });

  it('keeps a change while its save is still in flight', async () => {
    const store = await openApp();
    await store.load(D);
    let reply;
    api.put.mockImplementationOnce((url, body) => new Promise((r) => (reply = () => r(put(url, body)))));
    store.setNotes('in flight');
    const saving = store.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(stored(D).notes.value).toBe('in flight'); // the page could close now
    reply();
    await saving;
    expect(stored(D)).toBeNull();
  });

  it('survives a refresh after a failed save, and sends it when the app opens again', async () => {
    let store = await openApp();
    await store.load(D);
    api.put.mockRejectedValueOnce(offline());
    store.setNotes('a long entry written offline');
    store.setTrackerNote(sadness, 'and a card note');
    await store.flush();
    expect(store.problem).toBe('network');
    expect(stored(D).notes.value).toBe('a long entry written offline');

    store = await openApp(); // refresh
    await store.load(D);
    expect(server.get(D).notes).toBe('a long entry written offline');
    expect(server.get(D).trackerNotes).toEqual([{ trackerId: 1, note: 'and a card note' }]);
    expect(store.day.notes).toBe('a long entry written offline');
    expect(stored(D)).toBeNull();
    expect(store.unsaved).toBe(false);
  });

  it('shows restored changes on the day while they still can’t be saved', async () => {
    seed(D, { notes: { value: 'not lost', base: '' }, [`rating:1`]: { value: { trackerId: 1, value: 3, scaleMax: 5, actedOn: null }, base: { trackerId: 1, value: null } } });
    api.put.mockRejectedValue(Object.assign(new Error('Bad gateway'), { status: 502 }));
    const store = await openApp();
    await store.load(D);
    expect(store.day.notes).toBe('not lost');
    expect(store.day.ratings[1]).toEqual({ value: 3, scaleMax: 5, actedOn: null });
    expect(store.problem).toBe('network');
    expect(store.unsaved).toBe(true);
    expect(stored(D).notes.value).toBe('not lost');
  });

  it('keeps the right starting point for edits made while a save is in flight', async () => {
    let store = await openApp();
    await store.load(D);
    let reply;
    api.put.mockImplementationOnce((url, body) => new Promise((r) => (reply = () => r(put(url, body)))));
    store.setNotes('first');
    const saving = store.flush();
    await vi.advanceTimersByTimeAsync(0);
    store.setNotes('first, then more');
    reply();
    await saving;
    expect(stored(D).notes).toEqual({ value: 'first, then more', base: 'first' });

    // The page closes before that's sent. Next time, the server still has "first": no conflict.
    store = await openApp();
    await store.load(D);
    expect(server.get(D).notes).toBe('first, then more');
  });

  it('carries on if the device can’t store anything, and says so', async () => {
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const store = await openApp();
    await store.load(D);
    store.setNotes('still saved to the server');
    expect(store.keptOnDevice).toBe(false);
    await store.flush();
    expect(server.get(D).notes).toBe('still saved to the server');
    expect(store.keptOnDevice).toBe(true);
  });

  it('forget() (on logout) clears unsaved changes here and on the device', async () => {
    const store = await openApp();
    await store.load(D);
    api.put.mockRejectedValueOnce(offline());
    store.setNotes('private');
    await store.flush();
    store.forget();
    expect(storage.length).toBe(0);
    expect(store.unsaved).toBe(false);
    await store.flush();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(api.put).toHaveBeenCalledTimes(1);
  });
});

describe('restored changes are checked against the server first', () => {
  it('does not resend what the server already has (the page closed before the reply)', async () => {
    server.set(D, { ...rawDay(D), notes: 'already there' });
    seed(D, { notes: { value: 'already there', base: '' } });
    const store = await openApp();
    await store.load(D);
    expect(api.put).not.toHaveBeenCalled();
    expect(stored(D)).toBeNull();
  });

  it('lets the server win for a rating changed on another device since', async () => {
    server.set(D, { ...rawDay(D), ratings: [{ trackerId: 1, value: 2, scaleMax: 5, actedOn: null }] });
    seed(D, { 'rating:1': { value: { trackerId: 1, value: 4, scaleMax: 5, actedOn: null }, base: { trackerId: 1, value: null } } });
    const store = await openApp();
    await store.load(D);
    expect(api.put).not.toHaveBeenCalled();
    expect(store.day.ratings[1].value).toBe(2);
  });

  it('adds her text below text written on another device since, so neither is lost', async () => {
    server.set(D, { ...rawDay(D), notes: 'Morning.\nAdded on the phone.' });
    seed(D, { notes: { value: 'Morning.\nWritten on the laptop.', base: 'Morning.' } });
    const store = await openApp();
    await store.load(D);
    const merged = 'Morning.\nAdded on the phone.\n\n— Recovered from this device —\nMorning.\nWritten on the laptop.';
    expect(server.get(D).notes).toBe(merged);
    expect(store.day.notes).toBe(merged);
  });

  it('drops recovered text that the server’s newer version already contains', async () => {
    server.set(D, { ...rawDay(D), trackerNotes: [{ trackerId: 1, note: 'tired\nthen carried on on the phone' }] });
    seed(D, { 'trackerNote:1': { value: { trackerId: 1, note: 'tired' }, base: { trackerId: 1, note: null } } });
    const store = await openApp();
    await store.load(D);
    expect(api.put).not.toHaveBeenCalled();
    expect(store.day.trackerNotes[1]).toBe('tired\nthen carried on on the phone');
  });

  it('checks and sends changes left for another day, without opening it', async () => {
    seed('2026-02-27', { notes: { value: 'from two days ago', base: '' } });
    const store = await openApp();
    await store.load(D);
    expect(api.get).toHaveBeenCalledWith('/days/2026-02-27');
    expect(server.get('2026-02-27').notes).toBe('from two days ago');
    expect(storage.length).toBe(0);
  });

  it('keeps them, still unchecked, while the server can’t be reached', async () => {
    seed(D, { notes: { value: 'mine', base: '' } });
    api.get.mockRejectedValue(offline());
    let store = await openApp();
    await store.load(D);
    expect(stored(D).notes.value).toBe('mine');

    // Meanwhile it was changed on another device, so it's checked (and merged) when the server's back.
    api.get.mockReset().mockImplementation(async (url) => structuredClone(rawDay(url.split('/').pop())));
    server.set(D, { ...rawDay(D), notes: 'theirs' });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(server.get(D).notes).toBe('theirs\n\n— Recovered from this device —\nmine');
  });
});

describe('retrying', () => {
  it('retries by itself after a network failure, waiting longer each time', async () => {
    const store = await openApp();
    await store.load(D);
    api.put.mockRejectedValueOnce(offline()).mockRejectedValueOnce(offline());
    store.setNotes('retry me');
    await vi.advanceTimersByTimeAsync(800);
    expect(api.put).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(api.put).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(api.put).toHaveBeenCalledTimes(2); // second wait is 15 s
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.put).toHaveBeenCalledTimes(3);
    expect(server.get(D).notes).toBe('retry me');
    expect(store.problem).toBeNull();
    expect(store.status).toBe('saved');
  });

  it('does not retry by itself while logged out (it resumes after logging in)', async () => {
    const store = await openApp();
    await store.load(D);
    api.put.mockRejectedValueOnce(Object.assign(new Error('Not logged in'), { status: 401 }));
    store.setNotes('waiting for login');
    await store.flush();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(store.problem).toBe('auth');
    expect(stored(D).notes.value).toBe('waiting for login');
  });

  it('drops a change the server refuses, rather than keeping it forever', async () => {
    const store = await openApp();
    await store.load(D);
    api.put.mockRejectedValueOnce(Object.assign(new Error('Unknown tracker 1'), { status: 400 }));
    store.setRating(sadness, 2);
    await store.flush();
    expect(store.problem).toBe('rejected');
    expect(stored(D)).toBeNull();
  });

  it('uses keepalive only for saves made as the page closes', async () => {
    const store = await openApp();
    await store.load(D);
    store.setNotes('typed');
    await store.flush();
    expect(api.put.mock.calls[0]).toHaveLength(2);
    store.setNotes('typed, then closed');
    await store.flush({ keepalive: true });
    expect(api.put.mock.calls[1][2]).toEqual({ keepalive: true });
  });
});
