// DBT skill modules, in the order DBT usually teaches them.
export const MODULES = [
  { key: 'mindfulness', label: 'Mindfulness' },
  { key: 'distress', label: 'Distress Tolerance' },
  { key: 'emotion', label: 'Emotion Regulation' },
  { key: 'interpersonal', label: 'Interpersonal' },
];

export const moduleLabel = (key) => MODULES.find((m) => m.key === key)?.label ?? key;
const moduleIndex = (key) => MODULES.findIndex((m) => m.key === key);

// Module order, then her own order within a module.
export const compareSkills = (a, b) => moduleIndex(a.module) - moduleIndex(b.module) || a.sortOrder - b.sortOrder || a.id - b.id;

// The skills on the Day screen, as ids in module order: the ones she starred in Settings, plus
// any ticked on this day (from Browse, or since archived) so she can always see and untick them.
export function daySkillIds(skills, tickedToday = {}) {
  return skills
    .filter((s) => (s.starred && !s.archived) || tickedToday[s.id])
    .sort(compareSkills)
    .map((s) => s.id);
}

// Search box + module filter for "Browse all skills". Matches name or description, any order of words.
export function filterSkills(skills, { query = '', module = null } = {}) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return skills
    .filter((s) => !module || s.module === module)
    .filter((s) => {
      const text = `${s.name} ${s.description}`.toLowerCase();
      return words.every((w) => text.includes(w));
    })
    .sort(compareSkills);
}
