import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../src/api.js', () => ({ api }));

const { useDayStore, normalizeDay, isEmptyDay } = await import('../src/stores/day.js');

const sadness = { id: 1, kind: 'emotion', scaleMax: 5, trackActed: false };
const urge = { id: 2, kind: 'urge', scaleMax: 5, trackActed: true };
const med = { id: 7 };
const emptyRaw = (date) => ({ date, notes: '', ratings: [], medications: [] });

let store;
beforeEach(async () => {
  vi.useFakeTimers();
  setActivePinia(createPinia());
  api.get.mockReset().mockImplementation(async (url) => emptyRaw(url.split('/').pop()));
  api.put.mockReset().mockResolvedValue({});
  store = useDayStore();
  await store.load('2026-03-01');
  // Pending saves live at module level; make sure each test starts clean.
  await store.flush();
  api.put.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('normalizeDay / isEmptyDay', () => {
  it('keys ratings and medications by id', () => {
    const d = normalizeDay({
      date: '2026-03-01',
      notes: null,
      ratings: [{ trackerId: 1, value: 3, scaleMax: 5, actedOn: null }],
      medications: [{ medicationId: 7, taken: false }],
    });
    expect(d).toEqual({
      date: '2026-03-01',
      notes: '',
      ratings: { 1: { value: 3, scaleMax: 5, actedOn: null } },
      medications: { 7: false },
      trackerNotes: {},
      skills: {},
      period: null,
    });
    expect(isEmptyDay(d)).toBe(false);
  });

  it('treats whitespace-only notes and no answers as empty', () => {
    expect(isEmptyDay(normalizeDay({ ...emptyRaw('2026-03-01'), notes: ' \n ' }))).toBe(true);
    expect(isEmptyDay(normalizeDay({ ...emptyRaw('2026-03-01'), medications: [{ medicationId: 1, taken: false }] }))).toBe(false);
  });

  it('counts a day with only a card note as an entry, but not a blank one', () => {
    const withNote = normalizeDay({ ...emptyRaw('2026-03-01'), trackerNotes: [{ trackerId: 1, note: 'only this' }] });
    expect(withNote.trackerNotes).toEqual({ 1: 'only this' });
    expect(isEmptyDay(withNote)).toBe(false);
    expect(isEmptyDay({ ...withNote, trackerNotes: { 1: '  \n' } })).toBe(true);
  });
});

describe('autosave', () => {
  it('batches rapid changes into one save after a pause', async () => {
    store.setRating(sadness, 2);
    store.setRating(sadness, 4);
    store.setMedication(med, true);
    store.setNotes('a');
    store.setNotes('ab');
    expect(store.status).toBe('pending');
    expect(api.put).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(800);
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put).toHaveBeenCalledWith('/days/2026-03-01', {
      notes: 'ab',
      ratings: [{ trackerId: 1, value: 4, scaleMax: 5, actedOn: null }],
      medications: [{ medicationId: 7, taken: true }],
      trackerNotes: [],
      skills: [],
    });
    expect(store.status).toBe('saved');
  });

  it('saves card notes as typed, with blank notes sent as deletions', async () => {
    store.setTrackerNote(sadness, '\n');
    expect(store.day.trackerNotes[sadness.id]).toBe('\n'); // a leading newline isn't swallowed
    store.setTrackerNote(sadness, '\nMissed Mum');
    store.setTrackerNote(urge, 'passed');
    store.setTrackerNote(urge, '   ');
    await store.flush();
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put.mock.calls[0][1].trackerNotes).toEqual([
      { trackerId: 1, note: '\nMissed Mum' },
      { trackerId: 2, note: null },
    ]);
  });

  it('a card note and a rating on the same card are saved independently', async () => {
    store.setTrackerNote(sadness, 'heavy day');
    store.setRating(sadness, 4);
    store.setRating(sadness, null);
    await store.flush();
    const body = api.put.mock.calls[0][1];
    expect(body.ratings).toEqual([{ trackerId: 1, value: null }]);
    expect(body.trackerNotes).toEqual([{ trackerId: 1, note: 'heavy day' }]);
    expect(store.day.trackerNotes[sadness.id]).toBe('heavy day');
  });

  it('retries card notes after a network failure', async () => {
    api.put.mockRejectedValueOnce(new Error('offline'));
    store.setTrackerNote(sadness, 'written offline');
    await store.flush();
    await store.flush();
    expect(api.put).toHaveBeenCalledTimes(2);
    expect(api.put.mock.calls[1][1].trackerNotes).toEqual([{ trackerId: 1, note: 'written offline' }]);
  });

  it('ticking and unticking skills', async () => {
    const wiseMind = { id: 11 };
    const tipp = { id: 12 };
    store.setSkill(wiseMind, true);
    store.setSkill(tipp, true);
    store.setSkill(tipp, false);
    expect(store.day.skills).toEqual({ 11: true });
    await store.flush();
    expect(api.put.mock.calls[0][1].skills).toEqual([
      { skillId: 11, used: true },
      { skillId: 12, used: false },
    ]);
  });

  it('a day with only skills ticked counts as an entry', () => {
    expect(isEmptyDay(normalizeDay({ ...emptyRaw('2026-03-01'), skills: [3] }))).toBe(false);
  });

  it('omits notes and period when they were not touched', async () => {
    store.setRating(sadness, 1);
    await store.flush();
    expect(api.put.mock.calls[0][1]).not.toHaveProperty('notes');
    expect(api.put.mock.calls[0][1]).not.toHaveProperty('period');
  });

  it('saves the period as last set, and a period-only day counts as an entry', async () => {
    store.setPeriod({ flow: null });
    store.setPeriod({ flow: 'medium' });
    expect(store.day.period).toEqual({ flow: 'medium' });
    await store.flush();
    expect(api.put.mock.calls[0][1].period).toEqual({ flow: 'medium' });

    store.setPeriod(null);
    await store.flush();
    expect(api.put.mock.calls[1][1].period).toBeNull();

    expect(isEmptyDay(normalizeDay({ ...emptyRaw('2026-03-01'), period: { flow: null } }))).toBe(false);
  });

  it('clearing a rating sends null, and acted-on needs a rating first', async () => {
    store.setActed(urge, true); // ignored: no rating yet
    expect(store.day.ratings[urge.id]).toBeUndefined();

    store.setRating(urge, 3);
    store.setActed(urge, true);
    store.setRating(urge, null);
    await store.flush();
    expect(api.put.mock.calls[0][1].ratings).toEqual([{ trackerId: 2, value: null }]);
  });

  it('re-rating keeps the acted-on answer and the scale the entry was recorded on', async () => {
    api.get.mockResolvedValueOnce({
      date: '2026-03-02',
      notes: '',
      ratings: [{ trackerId: 2, value: 8, scaleMax: 10, actedOn: true }], // tracker scale since lowered to 5
      medications: [],
    });
    await store.load('2026-03-02');
    store.setRating(urge, 9);
    await store.flush();
    expect(api.put).toHaveBeenCalledWith('/days/2026-03-02', expect.objectContaining({
      ratings: [{ trackerId: 2, value: 9, scaleMax: 10, actedOn: true }],
    }));
  });

  it('saves pending changes before switching days, to the day they were made on', async () => {
    store.setRating(sadness, 3);
    await store.load('2026-03-02');
    expect(api.put).toHaveBeenCalledWith('/days/2026-03-01', expect.anything());
    expect(store.date).toBe('2026-03-02');
  });

  it('retries after a network failure, on the original day, even after moving on', async () => {
    api.put.mockRejectedValueOnce(Object.assign(new Error('Failed to fetch'), { status: undefined }));
    store.setNotes('written offline');
    await store.flush();
    expect(store.status).toBe('error');

    await store.load('2026-03-02'); // load() flushes: the retry goes to Mar 1, not Mar 2
    const calls = api.put.mock.calls.map(([url, body]) => [url, body.notes]);
    expect(calls).toEqual([
      ['/days/2026-03-01', 'written offline'],
      ['/days/2026-03-01', 'written offline'],
    ]);
  });

  it('a retry does not overwrite newer edits made while offline', async () => {
    api.put.mockRejectedValueOnce(new Error('offline'));
    store.setRating(sadness, 2);
    const first = store.flush();
    store.setRating(sadness, 5); // newer edit while the failing save is in flight
    await first;
    await store.flush();
    const last = api.put.mock.calls.at(-1)[1];
    expect(last.ratings).toEqual([{ trackerId: 1, value: 5, scaleMax: 5, actedOn: null }]);
  });

  it('does not retry forever when the server rejects the data', async () => {
    api.put.mockRejectedValueOnce(Object.assign(new Error('value must be an integer between 0 and 5'), { status: 400 }));
    store.setRating(sadness, 2);
    await store.flush();
    expect(store.status).toBe('error');
    expect(store.error).toMatch(/between 0 and 5/);
    await store.flush();
    expect(api.put).toHaveBeenCalledTimes(1);
  });

  it('keeps changes made while logged out, to send after logging back in', async () => {
    api.put.mockRejectedValueOnce(Object.assign(new Error('Not logged in'), { status: 401 }));
    store.setNotes('important');
    await store.flush();
    await store.flush();
    expect(api.put).toHaveBeenCalledTimes(2);
    expect(api.put.mock.calls[1][1].notes).toBe('important');
  });

  it('ignores a slow load for a day she has already navigated away from', async () => {
    let resolveSlow;
    api.get.mockImplementationOnce(() => new Promise((r) => (resolveSlow = r)));
    const slow = store.load('2026-03-05');
    await store.load('2026-03-06');
    resolveSlow({ ...emptyRaw('2026-03-05'), notes: 'stale' });
    await slow;
    expect(store.day.date).toBe('2026-03-06');
    expect(store.day.notes).toBe('');
  });
});
