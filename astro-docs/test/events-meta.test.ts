import { describe, expect, it } from 'vitest';

import {
  comparePastEvents,
  compareUpcomingEvents,
  type SortableEvent,
} from '../src/components/events/eventMeta';
import { type EventDate } from '../src/schema/event-date';

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

const ev = (date: EventDate, title: string): SortableEvent => ({ date, title });

describe('compareUpcomingEvents', () => {
  it('sorts ascending by effective date with TBA bucketed last', () => {
    const sorted = [
      ev(tba, 'TBA event'),
      ev(exact('2026-10-01'), 'October'),
      ev(exact('2026-08-01'), 'August'),
      ev(month(2026, 9), 'September'),
    ].sort(compareUpcomingEvents);
    expect(sorted.map((e) => e.title)).toEqual([
      'August',
      'September',
      'October',
      'TBA event',
    ]);
  });

  it('breaks same-date ties by title A→Z', () => {
    const sorted = [
      ev(exact('2026-09-15'), 'Zeta'),
      ev(exact('2026-09-15'), 'Alpha'),
      ev(exact('2026-09-15'), 'Mike'),
    ].sort(compareUpcomingEvents);
    expect(sorted.map((e) => e.title)).toEqual(['Alpha', 'Mike', 'Zeta']);
  });

  it('orders two TBA events by title A→Z (still last-bucketed)', () => {
    const sorted = [
      ev(tba, 'Bravo'),
      ev(exact('2026-08-01'), 'Dated'),
      ev(tba, 'Alpha'),
    ].sort(compareUpcomingEvents);
    expect(sorted.map((e) => e.title)).toEqual(['Dated', 'Alpha', 'Bravo']);
  });
});

describe('comparePastEvents', () => {
  it('sorts descending by effective date (most recent first)', () => {
    const sorted = [
      ev(exact('2026-01-01'), 'January'),
      ev(exact('2026-06-01'), 'June'),
      ev(exact('2026-03-01'), 'March'),
    ].sort(comparePastEvents);
    expect(sorted.map((e) => e.title)).toEqual(['June', 'March', 'January']);
  });

  it('breaks same-date ties by title A→Z', () => {
    const sorted = [
      ev(exact('2026-05-01'), 'Zeta'),
      ev(exact('2026-05-01'), 'Alpha'),
      ev(exact('2026-05-01'), 'Mike'),
    ].sort(comparePastEvents);
    expect(sorted.map((e) => e.title)).toEqual(['Alpha', 'Mike', 'Zeta']);
  });
});
