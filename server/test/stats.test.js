import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, loggedIn } from './helpers.js';

let srv;
let c;
let tracker;
let skills;
let med;
before(async () => {
  srv = await startServer();
  c = await loggedIn(srv);
  tracker = (await c.get('/api/trackers')).data[0];
  skills = (await c.get('/api/skills')).data;
  med = (await c.post('/api/medications', { name: 'Sertraline' })).data;
});
after(() => srv.close());

const stats = async (today) => (await c.get(`/api/stats?today=${today}`)).data;
const rate = (date) => c.put(`/api/days/${date}`, { ratings: [{ trackerId: tracker.id, value: 2 }] });

test('an empty diary', async () => {
  assert.deepEqual(await stats('2026-03-10'), { streak: 0, skillsUsed: 0, totalEntries: 0 });
});

test('today is validated and required', async () => {
  assert.equal((await c.get('/api/stats')).status, 400);
  assert.equal((await c.get('/api/stats?today=2026-02-30')).status, 400);
  assert.equal((await srv.client().get('/api/stats?today=2026-03-10')).status, 401);
});

test('streak counts back from today, or from yesterday if today is not logged yet', async () => {
  for (const d of ['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09']) await rate(d);
  await rate('2026-03-04'); // a gap on 03-05 breaks the run

  assert.equal((await stats('2026-03-09')).streak, 4); // logged today
  assert.equal((await stats('2026-03-10')).streak, 4); // morning, today not logged yet
  assert.equal((await stats('2026-03-11')).streak, 0); // missed a whole day
  assert.equal((await stats('2026-03-04')).streak, 1);
  assert.equal((await stats('2026-03-10')).totalEntries, 5);
});

test('every kind of entry counts, but cleared days and blank notes do not', async () => {
  await c.put('/api/days/2026-04-01', { medications: [{ medicationId: med.id, taken: true }] });
  await c.put('/api/days/2026-04-02', { notes: 'just a note' });
  await c.put('/api/days/2026-04-03', { trackerNotes: [{ trackerId: tracker.id, note: 'card note' }] });
  await c.put('/api/days/2026-04-04', { skills: [{ skillId: skills[0].id, used: true }] });
  await c.put('/api/days/2026-04-05', { period: { flow: 'light' } });
  assert.equal((await stats('2026-04-05')).streak, 5);

  // A day that was filled in and then completely cleared.
  await rate('2026-04-06');
  await c.put('/api/days/2026-04-06', { ratings: [{ trackerId: tracker.id, value: null }], notes: '   ' });
  const s = await stats('2026-04-06');
  assert.equal(s.streak, 5); // 04-06 doesn't count, so the run ends at 04-05 (yesterday)
  assert.equal(s.totalEntries, 10); // 5 from the previous test + 5 here
});

test('skillsUsed counts every tick, all time', async () => {
  await c.put('/api/days/2026-04-06', { skills: skills.slice(0, 3).map((s) => ({ skillId: s.id, used: true })) });
  assert.equal((await stats('2026-04-06')).skillsUsed, 4); // 1 on 04-04 + 3 here
  await c.put('/api/days/2026-04-06', { skills: [{ skillId: skills[0].id, used: false }] });
  assert.equal((await stats('2026-04-06')).skillsUsed, 3);
});
