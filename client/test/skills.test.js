import { describe, it, expect } from 'vitest';
import { recentSkillIds, filterSkills, compareSkills, RECENT_COUNT } from '../src/utils/skills.js';

let nextId = 1;
const skill = (module, name, extra = {}) => ({
  id: nextId++,
  module,
  name,
  description: `${name} description`,
  starter: false,
  sortOrder: nextId,
  archived: false,
  lastUsed: null,
  ...extra,
});

// Deliberately out of module order, to check sorting.
const skills = [
  skill('interpersonal', 'DEAR MAN', { starter: true }),
  skill('mindfulness', 'Wise Mind', { starter: true }),
  skill('mindfulness', 'Observe', { starter: true }),
  skill('distress', 'TIPP'),
  skill('distress', 'Self-soothe', { starter: true, description: 'Comfort through the five senses' }),
  skill('emotion', 'Check the Facts', { starter: true }),
  skill('emotion', 'Opposite Action', { starter: true }),
  skill('emotion', 'Cope Ahead'),
  skill('interpersonal', 'GIVE', { starter: true }),
  skill('distress', 'Old skill', { archived: true, starter: true, lastUsed: '2026-03-09' }),
];
const id = (name) => skills.find((s) => s.name === name).id;
const names = (ids) => ids.map((i) => skills.find((s) => s.id === i).name);

describe('recentSkillIds', () => {
  it('with no history, shows the starter skills in module order', () => {
    expect(names(recentSkillIds(skills))).toEqual(['Wise Mind', 'Observe', 'Self-soothe', 'Check the Facts', 'Opposite Action', 'DEAR MAN']);
  });

  it('puts the most recently used first, then tops up with starters', () => {
    const withHistory = skills.map((s) =>
      s.name === 'TIPP' ? { ...s, lastUsed: '2026-03-08' } : s.name === 'Cope Ahead' ? { ...s, lastUsed: '2026-03-05' } : s
    );
    expect(names(recentSkillIds(withHistory))).toEqual(['TIPP', 'Cope Ahead', 'Wise Mind', 'Observe', 'Self-soothe', 'Check the Facts']);
  });

  it("puts the day's ticks first and always shows all of them", () => {
    const ticked = Object.fromEntries(['GIVE', 'TIPP', 'Cope Ahead', 'Observe', 'Wise Mind', 'DEAR MAN', 'Self-soothe'].map((n) => [id(n), true]));
    const ids = recentSkillIds(skills, ticked);
    expect(ids.length).toBe(7); // more than RECENT_COUNT because 7 are ticked
    expect(names(ids)).toEqual(['Wise Mind', 'Observe', 'TIPP', 'Self-soothe', 'Cope Ahead', 'DEAR MAN', 'GIVE']);
  });

  it('never suggests archived skills, but shows one if it was ticked that day', () => {
    expect(names(recentSkillIds(skills))).not.toContain('Old skill');
    expect(names(recentSkillIds(skills, { [id('Old skill')]: true }))[0]).toBe('Old skill');
  });

  it('shows RECENT_COUNT skills when there are enough', () => {
    expect(recentSkillIds(skills)).toHaveLength(RECENT_COUNT);
  });

  it('copes with fewer skills than RECENT_COUNT', () => {
    expect(recentSkillIds(skills.slice(0, 2))).toHaveLength(2);
    expect(recentSkillIds([])).toEqual([]);
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
