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

export const RECENT_COUNT = 6;

/*
 * The "Recent" list on the Day screen, as skill ids:
 *   1. skills ticked on this day (so she can always see and untick them),
 *   2. then her most recently used skills,
 *   3. topped up with the 13 starter skills while she has fewer than RECENT_COUNT of her own.
 * Shows at least RECENT_COUNT skills, and more only if more than that are ticked today.
 */
export function recentSkillIds(skills, tickedToday = {}) {
  const active = skills.filter((s) => !s.archived);
  const ticked = skills.filter((s) => tickedToday[s.id]).sort(compareSkills);
  const used = active
    .filter((s) => s.lastUsed)
    .sort((a, b) => b.lastUsed.localeCompare(a.lastUsed) || compareSkills(a, b));
  const starters = active.filter((s) => s.starter).sort(compareSkills);

  const ids = [];
  for (const s of [...ticked, ...used, ...starters]) if (!ids.includes(s.id)) ids.push(s.id);
  return ids.slice(0, Math.max(RECENT_COUNT, ticked.length));
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
