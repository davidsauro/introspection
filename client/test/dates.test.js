import { describe, it, expect, vi, afterEach } from 'vitest';
import { today, addDays, daysBetween, dateRange, isValidDate, relativeLabel } from '../src/utils/dates.js';

afterEach(() => vi.useRealTimers());

describe('addDays', () => {
  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('never skips or repeats a day across daylight-saving changes', () => {
    // US DST starts 2026-03-08 and ends 2026-11-01; walk a day at a time through both.
    for (const start of ['2026-03-05', '2026-10-29']) {
      let d = start;
      const seen = new Set();
      for (let i = 0; i < 7; i++) {
        seen.add(d);
        d = addDays(d, 1);
      }
      expect(seen.size).toBe(7);
      expect(d).toBe(addDays(start, 7));
    }
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });
});

describe('daysBetween / dateRange', () => {
  it('counts days inclusive of both ends in dateRange', () => {
    expect(daysBetween('2026-03-01', '2026-03-31')).toBe(30);
    expect(dateRange('2026-03-07', '2026-03-10')).toEqual(['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10']);
    expect(dateRange('2026-03-07', '2026-03-07')).toEqual(['2026-03-07']);
    expect(dateRange('2026-03-08', '2026-03-07')).toEqual([]);
    expect(daysBetween('2026-03-10', '2026-03-07')).toBe(-3);
  });
});

describe('isValidDate', () => {
  it('accepts real dates only', () => {
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true);
    for (const bad of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-1-1', '', undefined, null, 20260101]) {
      expect(isValidDate(bad)).toBe(false);
    }
  });
});

describe('today', () => {
  it('uses the local calendar date, not UTC', () => {
    vi.useFakeTimers();
    // 11pm local time on Mar 7: in UTC it may already be Mar 8, but the diary day is Mar 7.
    vi.setSystemTime(new Date(2026, 2, 7, 23, 30));
    expect(today()).toBe('2026-03-07');
    vi.setSystemTime(new Date(2026, 2, 8, 0, 5));
    expect(today()).toBe('2026-03-08');
  });

  it('labels today, yesterday and tomorrow', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 7, 12));
    expect(relativeLabel('2026-03-07')).toBe('Today');
    expect(relativeLabel('2026-03-06')).toBe('Yesterday');
    expect(relativeLabel('2026-03-08')).toBe('Tomorrow');
    expect(relativeLabel('2026-03-01')).toBeNull();
  });
});
