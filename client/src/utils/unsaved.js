// Changes the server hasn't confirmed yet, kept in localStorage so they survive a refresh, a
// closed tab, or iOS unloading the app in the background while the connection is down.
// One key per day, so two open tabs editing different days don't overwrite each other.
// Each entry is { value, base }: what she changed it to, and what the server had when she did.

const PREFIX = 'diary:unsaved:';
const VERSION = 1;

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // e.g. storage blocked by the browser's settings
  }
}

// Returns false if the change couldn't be kept on the device (storage blocked or full).
export function writeUnsaved(date, entries) {
  const s = storage();
  if (!s) return false;
  try {
    if (entries.size) s.setItem(PREFIX + date, JSON.stringify({ v: VERSION, entries: Object.fromEntries(entries) }));
    else s.removeItem(PREFIX + date);
    return true;
  } catch {
    return false;
  }
}

// Map of date → Map of key → { value, base }.
export function readUnsaved() {
  const found = new Map();
  const s = storage();
  if (!s) return found;
  try {
    for (let i = 0; i < s.length; i++) {
      const key = s.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      try {
        const saved = JSON.parse(s.getItem(key));
        if (saved?.v !== VERSION || !saved.entries) continue;
        const entries = new Map(Object.entries(saved.entries));
        if (entries.size) found.set(key.slice(PREFIX.length), entries);
      } catch {
        // A damaged entry is skipped rather than stopping the others loading.
      }
    }
  } catch {
    // storage unreadable
  }
  return found;
}

export function clearUnsaved() {
  const s = storage();
  if (!s) return;
  try {
    const keys = [];
    for (let i = 0; i < s.length; i++) if (s.key(i)?.startsWith(PREFIX)) keys.push(s.key(i));
    for (const key of keys) s.removeItem(key);
  } catch {
    // nothing more we can do
  }
}
