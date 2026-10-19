import { describe, it, expect } from 'vitest';
import { daySkillIds, filterSkills, compareSkills } from '../src/utils/skills.js';

let nextId = 1;
const skill = (module, name, extra = {}) => ({
  id: nextId++,
  module,
  name,
  description: `${name} description`,
  starred: false,
  sortOrder: nextId,
  archived: false,
  ...extra,
});

// Deliberately out of module order, to check sorting.
const skills = [
  skill('interpersonal', 'DEAR MAN'),
  skill('mindfulness', 'Wise Mind'),
  skill('mindfulness', 'Observe'),
  skill('distress', 'TIPP'),
  skill('distress', 'Self-soothe', { description: 'Comfort through the five senses' }),
  skill('emotion', 'Check the Facts'),
  skill('emotion', 'Opposite Action'),
  skill('emotion', 'Cope Ahead'),
  skill('interpersonal', 'GIVE'),
  skill('distress', 'Old skill', { archived: true }),
];
const id = (name) => skills.find((s) => s.name === name).id;
const names = (ids) => ids.map((i) => skills.find((s) => s.id === i).name);
const starring = (...starred) => skills.map((s) => ({ ...s, starred: starred.includes(s.name) }));

describe('daySkillIds', () => {
  it('shows nothing until she stars some skills', () => {
    expect(daySkillIds(skills)).toEqual([]);
  });

  it('shows her starred skills in module order', () => {
    expect(names(daySkillIds(starring('GIVE', 'TIPP', 'Wise Mind', 'DEAR MAN')))).toEqual(['Wise Mind', 'TIPP', 'DEAR MAN', 'GIVE']);
  });

  it("adds the day's ticks, in module order with the starred ones", () => {
    const ticked = { [id('Cope Ahead')]: true, [id('Observe')]: true, [id('GIVE')]: true };
    expect(names(daySkillIds(starring('GIVE', 'TIPP'), ticked))).toEqual(['Observe', 'TIPP', 'Cope Ahead', 'GIVE']);
  });

  it('hides an archived skill even if starred, but shows one if it was ticked that day', () => {
    const starred = starring(...skills.map((s) => s.name));
    expect(names(daySkillIds(starred))).not.toContain('Old skill');
    expect(names(daySkillIds(starred, { [id('Old skill')]: true }))).toContain('Old skill');
  });

  it('copes with no skills', () => {
    expect(daySkillIds([])).toEqual([]);
  });
});

describe('filterSkills', () => {
  const active = skills.filter((s) => !s.archived);

  it('with no filters, returns everything in module order', () => {
    const all = filterSkills(active);
    expect(all).toHaveLength(active.length);
    expect(all.map((s) => s.module)).toEqual([...all].sort(compareSkills).map((s) => s.module));
    expect(all[0].module).toBe('mindfulness');
  });

  it('filters by module', () => {
    expect(filterSkills(active, { module: 'emotion' }).map((s) => s.name)).toEqual(['Check the Facts', 'Opposite Action', 'Cope Ahead']);
  });

  it('searches names and descriptions, case-insensitively, any word order', () => {
    expect(filterSkills(active, { query: 'tipp' }).map((s) => s.name)).toEqual(['TIPP']);
    expect(filterSkills(active, { query: 'senses five' }).map((s) => s.name)).toEqual(['Self-soothe']);
    expect(filterSkills(active, { query: '   ' })).toHaveLength(active.length);
    expect(filterSkills(active, { query: 'nothing matches' })).toEqual([]);
  });

  it('combines search with a module filter', () => {
    expect(filterSkills(active, { query: 'action', module: 'emotion' }).map((s) => s.name)).toEqual(['Opposite Action']);
    expect(filterSkills(active, { query: 'action', module: 'distress' })).toEqual([]);
  });
});
