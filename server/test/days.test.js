import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, loggedIn } from './helpers.js';

let srv;
let c;
let sadness; // emotion, 0-5
let selfHarm; // urge, 0-5, tracks acted-on
let med;
before(async () => {
  srv = await startServer();
  c = await loggedIn(srv);
  const trackers = (await c.get('/api/trackers')).data;
  sadness = trackers.find((t) => t.name === 'Sadness');
  selfHarm = trackers.find((t) => t.name === 'Self-harm');
  med = (await c.post('/api/medications', { name: 'Sertraline' })).data;
});
after(() => srv.close());

const rating = (day, id) => day.ratings.find((r) => r.trackerId === id);

test('a day with nothing saved comes back empty', async () => {
  const { status, data } = await c.get('/api/days/2026-03-01');
  assert.equal(status, 200);
  assert.deepEqual(data, { date: '2026-03-01', notes: '', ratings: [], medications: [], trackerNotes: [], skills: [], period: null, sleep: null });
});

test('dates are validated', async () => {
  for (const d of ['2026-02-30', '2026-13-01', '2026-1-01', 'today', '2026-03-01x']) {
    assert.equal((await c.get(`/api/days/${d}`)).status, 400, d);
    assert.equal((await c.put(`/api/days/${d}`, {})).status, 400, d);
  }
  assert.equal((await c.get('/api/days/2028-02-29')).status, 200); // leap day
});

test('saving a full day and reading it back', async () => {
  const res = await c.put('/api/days/2026-03-02', {
    notes: 'Rough morning.\nBetter by evening.',
    ratings: [
      { trackerId: sadness.id, value: 3 },
      { trackerId: selfHarm.id, value: 2, actedOn: false },
    ],
    medications: [{ medicationId: med.id, taken: true }],
  });
  assert.equal(res.status, 200);
  const day = (await c.get('/api/days/2026-03-02')).data;
  assert.equal(day.notes, 'Rough morning.\nBetter by evening.');
  assert.deepEqual(rating(day, sadness.id), { trackerId: sadness.id, value: 3, scaleMax: 5, actedOn: null });
  assert.deepEqual(rating(day, selfHarm.id), { trackerId: selfHarm.id, value: 2, scaleMax: 5, actedOn: false });
  assert.deepEqual(day.medications, [{ medicationId: med.id, taken: true }]);
});

test('partial saves leave everything else alone', async () => {
  await c.put('/api/days/2026-03-02', { ratings: [{ trackerId: sadness.id, value: 4 }] });
  let day = (await c.get('/api/days/2026-03-02')).data;
  assert.equal(day.notes, 'Rough morning.\nBetter by evening.');
  assert.equal(rating(day, sadness.id).value, 4);
  assert.equal(rating(day, selfHarm.id).value, 2);
  assert.equal(day.medications.length, 1);

  await c.put('/api/days/2026-03-02', { notes: '' });
  day = (await c.get('/api/days/2026-03-02')).data;
  assert.equal(day.notes, ''); // empty string clears notes (unlike omitting them)
  assert.equal(day.ratings.length, 2);
});

test('null clears a rating or a medication answer', async () => {
  await c.put('/api/days/2026-03-02', {
    ratings: [{ trackerId: sadness.id, value: null }],
    medications: [{ medicationId: med.id, taken: null }],
  });
  const day = (await c.get('/api/days/2026-03-02')).data;
  assert.equal(rating(day, sadness.id), undefined);
  assert.deepEqual(day.medications, []);
});

test('ratings outside the scale, and bad payloads, are rejected', async () => {
  const bad = [
    { ratings: [{ trackerId: sadness.id, value: 6 }] },
    { ratings: [{ trackerId: sadness.id, value: -1 }] },
    { ratings: [{ trackerId: sadness.id, value: 2.5 }] },
    { ratings: [{ trackerId: sadness.id, value: '3' }] },
    { ratings: [{ trackerId: sadness.id }] },
    { ratings: [{ trackerId: 99999, value: 1 }] },
    { ratings: [{ value: 1 }] },
    { ratings: [{ trackerId: '1', value: 1 }] },
    { ratings: [null] },
    { ratings: 'nope' },
    { ratings: [{ trackerId: selfHarm.id, value: 1, actedOn: 'yes' }] },
    { medications: [{ medicationId: med.id, taken: 'yes' }] },
    { medications: [{ medicationId: 99999, taken: true }] },
    { medications: [{ taken: true }] },
    { notes: 42 },
    { notes: 'x'.repeat(20001) },
  ];
  for (const body of bad) {
    const res = await c.put('/api/days/2026-03-03', body);
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 80));
  }
});

test('a save is all-or-nothing', async () => {
  const res = await c.put('/api/days/2026-03-04', {
    notes: 'should not be saved',
    ratings: [
      { trackerId: sadness.id, value: 2 },
      { trackerId: selfHarm.id, value: 99 },
    ],
  });
  assert.equal(res.status, 400);
  const day = (await c.get('/api/days/2026-03-04')).data;
  assert.equal(day.notes, '');
  assert.deepEqual(day.ratings, []);
});

test('changing a scale keeps old entries on the scale they were recorded on', async () => {
  const { data: t } = await c.post('/api/trackers', { kind: 'urge', name: 'Skip meals', scaleMax: 10 });
  await c.put('/api/days/2026-03-05', { ratings: [{ trackerId: t.id, value: 8 }] });
  await c.patch(`/api/trackers/${t.id}`, { scaleMax: 5 });

  // The old entry still reads 8 out of 10.
  let r = rating((await c.get('/api/days/2026-03-05')).data, t.id);
  assert.deepEqual([r.value, r.scaleMax], [8, 10]);

  // Editing the old entry on its own scale works...
  assert.equal((await c.put('/api/days/2026-03-05', { ratings: [{ trackerId: t.id, value: 9, scaleMax: 10 }] })).status, 200);
  r = rating((await c.get('/api/days/2026-03-05')).data, t.id);
  assert.deepEqual([r.value, r.scaleMax], [9, 10]);

  // ...a new day uses the new scale, and the old scale isn't accepted there...
  assert.equal((await c.put('/api/days/2026-03-06', { ratings: [{ trackerId: t.id, value: 8, scaleMax: 10 }] })).status, 400);
  assert.equal((await c.put('/api/days/2026-03-06', { ratings: [{ trackerId: t.id, value: 8 }] })).status, 400);
  assert.equal((await c.put('/api/days/2026-03-06', { ratings: [{ trackerId: t.id, value: 4 }] })).status, 200);
  r = rating((await c.get('/api/days/2026-03-06')).data, t.id);
  assert.deepEqual([r.value, r.scaleMax], [4, 5]);

  // ...and an arbitrary scale is never accepted.
  assert.equal((await c.put('/api/days/2026-03-05', { ratings: [{ trackerId: t.id, value: 7, scaleMax: 7 }] })).status, 400);
});

test('acted-on answers survive turning the question off', async () => {
  await c.put('/api/days/2026-03-07', { ratings: [{ trackerId: selfHarm.id, value: 3, actedOn: true }] });
  await c.patch(`/api/trackers/${selfHarm.id}`, { trackActed: false });
  // Re-rating the old entry (the app re-sends its acted-on answer) keeps it.
  await c.put('/api/days/2026-03-07', { ratings: [{ trackerId: selfHarm.id, value: 4, actedOn: true }] });
  const r = rating((await c.get('/api/days/2026-03-07')).data, selfHarm.id);
  assert.deepEqual([r.value, r.actedOn], [4, true]);
  await c.patch(`/api/trackers/${selfHarm.id}`, { trackActed: true });
});

test('archived trackers and medications keep their history and can still be edited', async () => {
  const { data: t } = await c.post('/api/trackers', { kind: 'emotion', name: 'Temporary' });
  await c.put('/api/days/2026-03-08', { ratings: [{ trackerId: t.id, value: 2 }] });
  await c.patch(`/api/trackers/${t.id}`, { archived: true });
  assert.equal(rating((await c.get('/api/days/2026-03-08')).data, t.id).value, 2);
  assert.equal((await c.put('/api/days/2026-03-08', { ratings: [{ trackerId: t.id, value: 3 }] })).status, 200);
});

test('a note per emotion/urge: saved, edited, independent of the rating, and cleared', async () => {
  const note = (day, id) => day.trackerNotes.find((n) => n.trackerId === id)?.note;
  const date = '2026-03-10';

  // A note with no rating is fine.
  await c.put(`/api/days/${date}`, { trackerNotes: [{ trackerId: sadness.id, note: 'Missed Mum today.\nCried after lunch.' }] });
  let day = (await c.get(`/api/days/${date}`)).data;
  assert.equal(note(day, sadness.id), 'Missed Mum today.\nCried after lunch.');
  assert.deepEqual(day.ratings, []);

  // Rating, then clearing the rating, leaves the note alone.
  await c.put(`/api/days/${date}`, { ratings: [{ trackerId: sadness.id, value: 4 }] });
  await c.put(`/api/days/${date}`, { ratings: [{ trackerId: sadness.id, value: null }] });
  day = (await c.get(`/api/days/${date}`)).data;
  assert.equal(note(day, sadness.id), 'Missed Mum today.\nCried after lunch.');

  // Other saves (notes, other notes) don't touch it.
  await c.put(`/api/days/${date}`, { notes: 'day notes', trackerNotes: [{ trackerId: selfHarm.id, note: 'Urge passed by evening' }] });
  day = (await c.get(`/api/days/${date}`)).data;
  assert.equal(note(day, sadness.id), 'Missed Mum today.\nCried after lunch.');
  assert.equal(note(day, selfHarm.id), 'Urge passed by evening');
  assert.equal(day.notes, 'day notes');

  // Editing replaces; blank or null deletes.
  await c.put(`/api/days/${date}`, { trackerNotes: [{ trackerId: sadness.id, note: 'Better now' }] });
  assert.equal(note((await c.get(`/api/days/${date}`)).data, sadness.id), 'Better now');
  await c.put(`/api/days/${date}`, { trackerNotes: [{ trackerId: sadness.id, note: '  \n ' }, { trackerId: selfHarm.id, note: null }] });
  assert.deepEqual((await c.get(`/api/days/${date}`)).data.trackerNotes, []);
});

test('tracker notes are validated', async () => {
  const bad = [
    { trackerNotes: [{ trackerId: sadness.id, note: 'x'.repeat(5001) }] },
    { trackerNotes: [{ trackerId: sadness.id, note: 42 }] },
    { trackerNotes: [{ trackerId: sadness.id }] },
    { trackerNotes: [{ trackerId: 99999, note: 'x' }] },
    { trackerNotes: [{ note: 'x' }] },
    { trackerNotes: 'nope' },
  ];
  for (const body of bad) assert.equal((await c.put('/api/days/2026-03-11', body)).status, 400, JSON.stringify(body).slice(0, 80));
  assert.equal((await c.put('/api/days/2026-03-11', { trackerNotes: [{ trackerId: sadness.id, note: 'x'.repeat(5000) }] })).status, 200);
});

test('a day with only a tracker note shows up in range queries', async () => {
  await c.put('/api/days/2026-03-12', { trackerNotes: [{ trackerId: selfHarm.id, note: 'only this' }] });
  const { data } = await c.get('/api/days?from=2026-03-12&to=2026-03-12');
  assert.deepEqual(data[0].trackerNotes, [{ trackerId: selfHarm.id, note: 'only this' }]);
});

test('range queries', async () => {
  const { data } = await c.get('/api/days?from=2026-03-01&to=2026-03-31');
  const dates = data.map((d) => d.date);
  assert.deepEqual(dates, [...dates].sort()); // sorted
  assert.ok(dates.includes('2026-03-02'));
  assert.ok(!dates.includes('2026-03-01')); // nothing saved that day
  assert.ok(!dates.includes('2026-03-04')); // the rejected save left nothing behind

  assert.equal((await c.get('/api/days?from=2026-03-01&to=2026-03-01')).status, 200);
  assert.equal((await c.get('/api/days?from=2026-03-02&to=2026-03-01')).status, 400);
  assert.equal((await c.get('/api/days?from=2026-01-01&to=2027-01-01')).status, 200); // exactly 366 days: allowed
  assert.equal((await c.get('/api/days?from=2026-01-01&to=2027-01-02')).status, 400); // 367 days
  assert.equal((await c.get('/api/days?from=2026-01-01')).status, 400);
  assert.equal((await c.get('/api/days?from=bad&to=2026-01-01')).status, 400);
});

test('period days: marked, flow changed, cleared, and listed in a range', async () => {
  let day = (await c.put('/api/days/2026-04-01', { period: { flow: null } })).data;
  assert.deepEqual(day.period, { flow: null });

  await c.put('/api/days/2026-04-01', { period: { flow: 'heavy' } });
  await c.put('/api/days/2026-04-02', { period: { flow: 'light' } });
  await c.put('/api/days/2026-04-01', { notes: 'unrelated' }); // omitting period leaves it alone
  day = (await c.get('/api/days/2026-04-01')).data;
  assert.deepEqual(day.period, { flow: 'heavy' });

  const range = (await c.get('/api/days?from=2026-04-01&to=2026-04-03')).data;
  assert.deepEqual(range.map((d) => [d.date, d.period]), [
    ['2026-04-01', { flow: 'heavy' }],
    ['2026-04-02', { flow: 'light' }],
  ]);

  await c.put('/api/days/2026-04-02', { period: null });
  day = (await c.get('/api/days/2026-04-02')).data;
  assert.equal(day.period, null);
});

test('period payloads are validated', async () => {
  for (const period of [true, 'heavy', { flow: 'spotting' }, { flow: 3 }]) {
    assert.equal((await c.put('/api/days/2026-04-05', { period })).status, 400, JSON.stringify(period));
  }
  assert.equal((await c.get('/api/days/2026-04-05')).data.period, null);
});

test('sleep: hours and checkboxes saved, replaced, and cleared', async () => {
  let day = (await c.put('/api/days/2026-05-01', { sleep: { hours: 8.2, fellAsleepQuickly: true } })).data;
  assert.deepEqual(day.sleep, { hours: 8.2, fellAsleepQuickly: true, stayedAsleep: false });

  day = (await c.put('/api/days/2026-05-01', { sleep: { hours: null, stayedAsleep: true } })).data;
  assert.deepEqual(day.sleep, { hours: null, fellAsleepQuickly: false, stayedAsleep: true });

  await c.put('/api/days/2026-05-01', { notes: 'unrelated' }); // omitting sleep leaves it alone
  assert.equal((await c.get('/api/days/2026-05-01')).data.sleep.stayedAsleep, true);

  // Nothing left to record is the same as no sleep entry.
  day = (await c.put('/api/days/2026-05-01', { sleep: { hours: null, fellAsleepQuickly: false, stayedAsleep: false } })).data;
  assert.equal(day.sleep, null);
  await c.put('/api/days/2026-05-01', { sleep: { hours: 0 } });
  day = (await c.put('/api/days/2026-05-01', { sleep: null })).data;
  assert.equal(day.sleep, null);
});

test('sleep payloads are validated', async () => {
  for (const sleep of [8, { hours: -1 }, { hours: 24.5 }, { hours: '8' }, { hours: 7, stayedAsleep: 'yes' }]) {
    assert.equal((await c.put('/api/days/2026-05-02', { sleep })).status, 400, JSON.stringify(sleep));
  }
  assert.equal((await c.put('/api/days/2026-05-02', { sleep: { hours: 24 } })).status, 200);
});
