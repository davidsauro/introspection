import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, loggedIn } from './helpers.js';

let srv;
let c;
before(async () => {
  srv = await startServer();
  c = await loggedIn(srv);
});
after(() => srv.close());

const skillNamed = async (name) => (await c.get('/api/skills?includeArchived=true')).data.find((s) => s.name === name);

test('first run seeds 32 skills in four modules, 13 of them starters', async () => {
  const { data } = await c.get('/api/skills');
  assert.equal(data.length, 32);
  const count = (m) => data.filter((s) => s.module === m).length;
  assert.deepEqual([count('mindfulness'), count('distress'), count('emotion'), count('interpersonal')], [7, 11, 8, 6]);
  assert.deepEqual(
    data.filter((s) => s.starter).map((s) => s.name),
    ['Wise Mind', 'Observe', 'Describe', 'Nonjudgmental stance', 'Distract with ACCEPTS', 'Self-soothe', 'Radical acceptance',
      'Check the Facts', 'Opposite Action', 'PLEASE', 'DEAR MAN', 'GIVE', 'Validation']
  );
  assert.ok(data.every((s) => s.description.length > 10 && s.lastUsed === null && !s.archived));
});

test('creating, editing, moving and archiving skills', async () => {
  const created = await c.post('/api/skills', { module: 'distress', name: '  Ice dive ', description: ' Cold water on the face. ' });
  assert.equal(created.status, 201);
  assert.deepEqual([created.data.name, created.data.description, created.data.starter], ['Ice dive', 'Cold water on the face.', false]);
  const distress = (await c.get('/api/skills')).data.filter((s) => s.module === 'distress');
  assert.equal(distress.at(-1).name, 'Ice dive');

  const moved = await c.patch(`/api/skills/${created.data.id}`, { module: 'emotion', description: '' });
  assert.equal(moved.data.module, 'emotion');
  assert.equal(moved.data.description, '');
  const emotion = (await c.get('/api/skills')).data.filter((s) => s.module === 'emotion');
  assert.equal(emotion.at(-1).id, created.data.id); // moved to the end of its new module

  await c.patch(`/api/skills/${created.data.id}`, { archived: true });
  assert.ok(!(await c.get('/api/skills')).data.some((s) => s.id === created.data.id));
  assert.ok((await skillNamed('Ice dive')).archived);
});

test('skill validation', async () => {
  const bad = [
    { module: 'nope', name: 'x' },
    { module: 'distress' },
    { module: 'distress', name: '' },
    { module: 'distress', name: 'x', description: 'd'.repeat(301) },
    { module: 'distress', name: 'x', description: 7 },
  ];
  for (const body of bad) assert.equal((await c.post('/api/skills', body)).status, 400, JSON.stringify(body).slice(0, 60));
  const wm = await skillNamed('Wise Mind');
  assert.equal((await c.patch(`/api/skills/${wm.id}`, { module: 'other' })).status, 400);
  assert.equal((await c.patch('/api/skills/99999', { name: 'x' })).status, 404);
  assert.equal((await c.put('/api/skills/order', 'x')).status, 400);
});

test('ticking skills on a day, and lastUsed for the Recent list', async () => {
  const wm = await skillNamed('Wise Mind');
  const tipp = await skillNamed('TIPP');
  await c.put('/api/days/2026-03-01', { skills: [{ skillId: wm.id, used: true }] });
  await c.put('/api/days/2026-03-05', { skills: [{ skillId: wm.id, used: true }, { skillId: tipp.id, used: true }] });
  await c.put('/api/days/2026-03-05', { skills: [{ skillId: tipp.id, used: true }] }); // ticking twice is harmless

  const day = (await c.get('/api/days/2026-03-05')).data;
  assert.deepEqual(day.skills.sort(), [wm.id, tipp.id].sort());
  assert.equal((await skillNamed('Wise Mind')).lastUsed, '2026-03-05');
  assert.equal((await skillNamed('Observe')).lastUsed, null);

  await c.put('/api/days/2026-03-05', { skills: [{ skillId: wm.id, used: false }] });
  assert.deepEqual((await c.get('/api/days/2026-03-05')).data.skills, [tipp.id]);
  assert.equal((await skillNamed('Wise Mind')).lastUsed, '2026-03-01');

  // Ticks on an archived skill stay in history.
  await c.patch(`/api/skills/${tipp.id}`, { archived: true });
  assert.deepEqual((await c.get('/api/days/2026-03-05')).data.skills, [tipp.id]);
  await c.patch(`/api/skills/${tipp.id}`, { archived: false });
});

test('skill ticks are validated', async () => {
  const wm = await skillNamed('Wise Mind');
  const bad = [
    { skills: [{ skillId: 99999, used: true }] },
    { skills: [{ skillId: wm.id }] },
    { skills: [{ skillId: wm.id, used: 'yes' }] },
    { skills: [{ used: true }] },
    { skills: 'nope' },
  ];
  for (const body of bad) assert.equal((await c.put('/api/days/2026-03-09', body)).status, 400, JSON.stringify(body));
});
