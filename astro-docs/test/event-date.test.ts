import { describe, expect, it } from 'vitest';

import {
  classify,
  comparePast,
  compareUpcoming,
  effectiveDate,
  type EventDate,
  formatDisplay,
} from '../src/schema/event-date';

const BUILD = new Date(Date.UTC(2026, 6, 24)); // 2026-07-24

const exact = (iso: string): EventDate => ({
  precision: 'exact',
  date: new Date(iso),
});
const month = (year: number, m: number): EventDate => ({
  precision: 'month',
  year,
  month: m,
});
const tba: EventDate = { precision: 'tba' };

describe('effectiveDate', () => {
  it('returns the exact date', () => {
    expect(effectiveDate(exact('2026-09-15'))?.getTime()).toBe(
      Date.UTC(2026, 8, 15),
    );
  });

  it('resolves month-only to the 1st of the month (UTC)', () => {
    expect(effectiveDate(month(2026, 9))?.getTime()).toBe(Date.UTC(2026, 8, 1));
  });

  it('returns null for TBA', () => {
    expect(effectiveDate(tba)).toBeNull();
  });
});

describe('classify', () => {
  it('treats today as upcoming', () => {
    expect(classify(exact('2026-07-24'), BUILD)).toBe('upcoming');
  });

  it('treats a future date as upcoming', () => {
    expect(classify(exact('2026-09-15'), BUILD)).toBe('upcoming');
  });

  it('treats a date before the build date as past', () => {
    expect(classify(exact('2026-07-23'), BUILD)).toBe('past');
  });

  it('ignores time-of-day (same calendar day is upcoming)', () => {
    expect(classify(exact('2026-07-24T23:59:59Z'), BUILD)).toBe('upcoming');
  });

  it('treats TBA as upcoming', () => {
    expect(classify(tba, BUILD)).toBe('upcoming');
  });

  it('classifies month-only by the 1st of the month', () => {
    expect(classify(month(2026, 7), BUILD)).toBe('past'); // 2026-07-01 < build
    expect(classify(month(2026, 8), BUILD)).toBe('upcoming');
  });
});

describe('compareUpcoming', () => {
  it('sorts ascending by date with TBA last', () => {
    const sorted = [
      tba,
      exact('2026-10-01'),
      exact('2026-08-01'),
      month(2026, 9),
    ].sort(compareUpcoming);
    expect(sorted).toEqual([
      exact('2026-08-01'),
      month(2026, 9),
      exact('2026-10-01'),
      tba,
    ]);
  });
});

describe('comparePast', () => {
  it('sorts descending by date (most recent first)', () => {
    const sorted = [
      exact('2026-01-01'),
      exact('2026-06-01'),
      exact('2026-03-01'),
    ].sort(comparePast);
    expect(sorted).toEqual([
      exact('2026-06-01'),
      exact('2026-03-01'),
      exact('2026-01-01'),
    ]);
  });
});

describe('formatDisplay', () => {
  it('formats month-only as `Month YYYY`', () => {
    expect(formatDisplay(month(2026, 9), 'en-US')).toBe('September 2026');
  });

  it('formats an exact date as a full date', () => {
    expect(formatDisplay(exact('2026-09-15'), 'en-US')).toBe(
      'September 15, 2026',
    );
  });

  it('renders TBA as the literal `Date TBA`', () => {
    expect(formatDisplay(tba, 'en-US')).toBe('Date TBA');
  });
});
