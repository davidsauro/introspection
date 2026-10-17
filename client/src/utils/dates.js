// Diary dates are plain 'YYYY-MM-DD' strings in her local time zone. Arithmetic is done
// in UTC on those strings so daylight-saving changes can never skip or repeat a day.
import { ref } from 'vue';

const pad = (n) => String(n).padStart(2, '0');

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Reactive "today" for UI that must notice midnight. A home-screen app can stay open (or be
// resumed) across days, so this re-checks every minute and whenever the app comes back.
export const currentDay = ref(today());
if (typeof window !== 'undefined') {
  const refresh = () => {
    if (currentDay.value !== today()) currentDay.value = today();
  };
  setInterval(refresh, 60_000);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('focus', refresh);
}

const toUtc = (date) => new Date(`${date}T00:00:00Z`);
const fromUtc = (d) => d.toISOString().slice(0, 10);

export function addDays(date, n) {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

export function daysBetween(from, to) {
  return Math.round((toUtc(to) - toUtc(from)) / 864e5);
}

export function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = toUtc(value);
  // Impossible dates like 2026-13-01 are Invalid Date; ones like 2026-02-30 roll over to March.
  return !Number.isNaN(d.getTime()) && fromUtc(d) === value;
}

const fmt = (opts) => new Intl.DateTimeFormat(undefined, { timeZone: 'UTC', ...opts });
const longFmt = fmt({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const mediumFmt = fmt({ weekday: 'short', month: 'short', day: 'numeric' });
const shortFmt = fmt({ month: 'short', day: 'numeric' });
const weekdayFmt = fmt({ weekday: 'narrow' });

export const formatLong = (date) => longFmt.format(toUtc(date));
export const formatMedium = (date) => mediumFmt.format(toUtc(date));
export const formatShort = (date) => shortFmt.format(toUtc(date));
export const formatWeekday = (date) => weekdayFmt.format(toUtc(date));

export function formatRange(from, to) {
  return from === to ? formatLong(from) : `${formatShort(from)} – ${formatLong(to)}`;
}

export function relativeLabel(date) {
  const diff = daysBetween(today(), date);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return null;
}
