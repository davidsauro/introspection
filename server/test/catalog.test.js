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

test('first run seeds default emotions and urges', async () => {
  const { data } = await c.get('/api/trackers');
  const names = (kind) => data.filter((t) => t.kind === kind).map((t) => t.name);
  assert.deepEqual(names('emotion'), ['Sadness', 'Anxiety / Fear', 'Anger', 'Shame', 'Guilt', 'Joy']);
  assert.deepEqual(names('urge'), ['Self-harm', 'Suicidal thoughts', 'Substance use', 'Isolating']);
  assert.ok(data.every((t) => t.scaleMax === 5));
  assert.ok(data.every((t) => t.trackActed === (t.kind === 'urge')));
  assert.deepEqual((await c.get('/api/medications')).data, []);
});

test('creating trackers: defaults and validation', async () => {
  const urge = await c.post('/api/trackers', { kind: 'urge', name: '  Binge eating  ' });
  assert.equal(urge.status, 201);
  assert.equal(urge.data.name, 'Binge eating'); // trimmed
  assert.equal(urge.data.scaleMax, 5);
  assert.equal(urge.data.trackActed, true);

  const emotion = await c.post('/api/trackers', { kind: 'emotion', name: 'Calm', scaleMax: 10 });
  assert.equal(emotion.data.trackActed, false);
  assert.equal(emotion.data.scaleMax, 10);

  const bad = [
    { kind: 'feeling', name: 'x' },
    { kind: 'urge' },
    { kind: 'urge', name: '   ' },
    { kind: 'urge', name: 'x'.repeat(61) },
    { kind: 'urge', name: 'x', scaleMax: 0 },
    { kind: 'urge', name: 'x', scaleMax: 11 },
    { kind: 'urge', name: 'x', scaleMax: 2.5 },
    { kind: 'urge', name: 'x', scaleMax: '5' },
    { kind: 'urge', name: 'x', trackActed: 'yes' },
  ];
  for (const body of bad) assert.equal((await c.post('/api/trackers', body)).status, 400, JSON.stringify(body));
});

test('new trackers go to the end of their own kind', async () => {
  const { data } = await c.get('/api/trackers');
  const urges = data.filter((t) => t.kind === 'urge');
  assert.equal(urges.at(-1).name, 'Binge eating');
  assert.equal(urges.at(-1).sortOrder, urges.length - 1);
});

test('editing and archiving a tracker', async () => {
  const { data: t } = await c.post('/api/trackers', { kind: 'emotion', name: 'Lonely' });
  const edited = await c.patch(`/api/trackers/${t.id}`, { name: 'Loneliness', scaleMax: 7, trackActed: true });
  assert.equal(edited.status, 200);
  assert.deepEqual([edited.data.name, edited.data.scaleMax, edited.data.trackActed], ['Loneliness', 7, true]);

  assert.equal((await c.patch(`/api/trackers/${t.id}`, { archived: true })).data.archived, true);
  assert.ok(!(await c.get('/api/trackers')).data.some((x) => x.id === t.id));
  assert.ok((await c.get('/api/trackers?includeArchived=true')).data.find((x) => x.id === t.id).archived);

  // Archiving twice keeps the original archive time.
  const first = srv.db.prepare('SELECT archived_at FROM trackers WHERE id = ?').get(t.id).archived_at;
  await c.patch(`/api/trackers/${t.id}`, { archived: true });
  assert.equal(srv.db.prepare('SELECT archived_at FROM trackers WHERE id = ?').get(t.id).archived_at, first);

  assert.equal((await c.patch(`/api/trackers/${t.id}`, { archived: false })).data.archived, false);
  assert.ok((await c.get('/api/trackers')).data.some((x) => x.id === t.id));
});

test('editing validates and 404s unknown ids', async () => {
  assert.equal((await c.patch('/api/trackers/1', { scaleMax: 11 })).status, 400);
  assert.equal((await c.patch('/api/trackers/1', { name: '' })).status, 400);
  assert.equal((await c.patch('/api/trackers/1', { archived: 'yes' })).status, 400);
  assert.equal((await c.patch('/api/trackers/99999', { name: 'x' })).status, 404);
  assert.equal((await c.patch('/api/trackers/abc', { name: 'x' })).status, 404);
});

test('reordering trackers', async () => {
  const emotions = (await c.get('/api/trackers')).data.filter((t) => t.kind === 'emotion');
  const reversed = emotions.map((t) => t.id).reverse();
  assert.equal((await c.put('/api/trackers/order', reversed)).status, 200);
  const after = (await c.get('/api/trackers')).data.filter((t) => t.kind === 'emotion');
  assert.deepEqual(after.map((t) => t.id), reversed);

  assert.equal((await c.put('/api/trackers/order', { ids: [1] })).status, 400);
  assert.equal((await c.put('/api/trackers/order', ['1', '2'])).status, 400);
});

test('medications: create, validate, edit, reorder, archive', async () => {
  const a = await c.post('/api/medications', { name: 'Sertraline', dose: '50mg' });
  assert.equal(a.status, 201);
  assert.deepEqual([a.data.name, a.data.dose], ['Sertraline', '50mg']);
  const b = await c.post('/api/medications', { name: 'Lamotrigine' });
  assert.equal(b.data.dose, '');

  assert.equal((await c.post('/api/medications', { name: '' })).status, 400);
  assert.equal((await c.post('/api/medications', { name: 'x', dose: 'd'.repeat(61) })).status, 400);
  assert.equal((await c.post('/api/medications', { name: 'x', dose: 5 })).status, 400);

  assert.equal((await c.patch(`/api/medications/${b.data.id}`, { dose: '100mg' })).data.dose, '100mg');
  assert.equal((await c.patch(`/api/medications/${b.data.id}`, { dose: '' })).data.dose, '');

  await c.put('/api/medications/order', [b.data.id, a.data.id]);
  assert.deepEqual((await c.get('/api/medications')).data.map((m) => m.name), ['Lamotrigine', 'Sertraline']);

  await c.patch(`/api/medications/${a.data.id}`, { archived: true });
  assert.deepEqual((await c.get('/api/medications')).data.map((m) => m.name), ['Lamotrigine']);
  assert.equal((await c.get('/api/medications?includeArchived=true')).data.length, 2);
  assert.equal((await c.patch('/api/medications/999', { name: 'x' })).status, 404);
});
