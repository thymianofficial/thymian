import { z } from 'astro:content';

/**
 * Flexible-precision event date fragment.
 *
 * Three precisions, modelled as a discriminated union so consumers get a clean,
 * typed shape and bad combinations fail the build:
 *  - `exact`  — a full calendar date.
 *  - `month`  — year + month only (effective date = the 1st of that month).
 *  - `tba`    — date not yet known (effective date = null; sorts as Upcoming, last).
 */
export const eventDateSchema = z.discriminatedUnion('precision', [
  z.object({
    precision: z.literal('exact'),
    date: z.coerce.date(),
  }),
  z.object({
    precision: z.literal('month'),
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
  }),
  z.object({
    precision: z.literal('tba'),
  }),
]);

/**
 * Parsed shape of {@link eventDateSchema}. Declared explicitly rather than via
 * `z.infer` because `astro:content` re-exports zod's `z` as a value only (its
 * type namespace is not carried), so `z.infer<...>` does not resolve here.
 */
export type EventDate =
  | { precision: 'exact'; date: Date }
  | { precision: 'month'; year: number; month: number }
  | { precision: 'tba' };

/**
 * The concrete `Date` an event effectively falls on, or `null` when TBA.
 * `month`-only precision resolves to the 1st of the month (UTC).
 */
export function effectiveDate(d: EventDate): Date | null {
  switch (d.precision) {
    case 'exact': {
      return d.date;
    }
    case 'month': {
      return new Date(Date.UTC(d.year, d.month - 1, 1));
    }
    case 'tba': {
      return null;
    }
  }
}

/** Normalise a `Date` to its UTC calendar day (time-of-day removed). */
function calendarDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Classify an event relative to the build date, comparing by calendar day only
 * (time-of-day ignored). An effective date on or after the build date is
 * `upcoming` (today counts as upcoming); TBA is always `upcoming`.
 */
export function classify(d: EventDate, buildDate: Date): 'upcoming' | 'past' {
  const eff = effectiveDate(d);
  if (eff === null) {
    return 'upcoming';
  }
  return calendarDay(eff) >= calendarDay(buildDate) ? 'upcoming' : 'past';
}

/** Comparator for Upcoming events: ascending by date, TBA (null) last. */
export function compareUpcoming(a: EventDate, b: EventDate): number {
  const ea = effectiveDate(a);
  const eb = effectiveDate(b);
  if (ea === null && eb === null) {
    return 0;
  }
  if (ea === null) {
    return 1;
  }
  if (eb === null) {
    return -1;
  }
  return ea.getTime() - eb.getTime();
}

/** Comparator for Past events: descending by date (most recent first). */
export function comparePast(a: EventDate, b: EventDate): number {
  const ea = effectiveDate(a);
  const eb = effectiveDate(b);
  // Past never contains TBA, but stay defensive: null sorts last.
  if (ea === null && eb === null) {
    return 0;
  }
  if (ea === null) {
    return 1;
  }
  if (eb === null) {
    return -1;
  }
  return eb.getTime() - ea.getTime();
}

/**
 * Human-readable date string via the shared module (no consumer re-formats):
 *  - `month`  → `Month YYYY` (e.g. `September 2026`).
 *  - `exact`  → a formatted full date (e.g. `September 15, 2026`).
 *  - `tba`    → the literal `Date TBA`.
 */
export function formatDisplay(d: EventDate, locale?: string): string {
  switch (d.precision) {
    case 'tba': {
      return 'Date TBA';
    }
    case 'month': {
      const eff = new Date(Date.UTC(d.year, d.month - 1, 1));
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }).format(eff);
    }
    case 'exact': {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(d.date);
    }
  }
}
