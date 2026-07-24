import { describe, expect, it } from 'vitest';

import {
  comparePastEvents,
  compareUpcomingEvents,
  resolveEventLinks,
  resolveGuestAttribution,
  type SortableEvent,
} from '../src/components/events/eventMeta';
import { type Attribution } from '../src/schema/attribution';
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

describe('resolveEventLinks', () => {
  it('surfaces a register link for an upcoming event with registerUrl', () => {
    expect(
      resolveEventLinks({
        timeframe: 'upcoming',
        registerUrl: 'https://example.com/register',
      }),
    ).toEqual([
      { label: 'Register to attend', url: 'https://example.com/register' },
    ]);
  });

  it('surfaces no link for an upcoming event without registerUrl', () => {
    expect(resolveEventLinks({ timeframe: 'upcoming' })).toEqual([]);
  });

  it('ignores resourceUrl on an upcoming event (resource is Past-only)', () => {
    expect(
      resolveEventLinks({
        timeframe: 'upcoming',
        resourceUrl: 'https://example.com/recording',
      }),
    ).toEqual([]);
  });

  it('surfaces a resource link for a past event with resourceUrl', () => {
    expect(
      resolveEventLinks({
        timeframe: 'past',
        resourceUrl: 'https://example.com/recording',
      }),
    ).toEqual([
      { label: 'View resource', url: 'https://example.com/recording' },
    ]);
  });

  it('surfaces no link for a past event without resourceUrl', () => {
    expect(resolveEventLinks({ timeframe: 'past' })).toEqual([]);
  });

  it('ignores registerUrl on a past event (register is Upcoming-only)', () => {
    expect(
      resolveEventLinks({
        timeframe: 'past',
        registerUrl: 'https://example.com/register',
      }),
    ).toEqual([]);
  });

  it('guards a whitespace-only url on an upcoming event', () => {
    expect(
      resolveEventLinks({ timeframe: 'upcoming', registerUrl: '   ' }),
    ).toEqual([]);
  });

  it('trims surrounding whitespace off the emitted url', () => {
    expect(
      resolveEventLinks({
        timeframe: 'upcoming',
        registerUrl: '  https://example.com/register  ',
      }),
    ).toEqual([
      { label: 'Register to attend', url: 'https://example.com/register' },
    ]);
  });
});

describe('resolveGuestAttribution (AD-13 honest attribution)', () => {
  const guest: Attribution = {
    hostGuest: 'guest',
    externalHost: 'My Coding Zone',
    platform: 'YouTube',
    externalUrl: 'https://youtube.com/mycodingzone',
  };

  it('returns null for an absent attribution (nothing to render)', () => {
    expect(resolveGuestAttribution(undefined)).toBeNull();
  });

  it('returns null for a host event (no external host to credit)', () => {
    expect(resolveGuestAttribution({ hostGuest: 'host' })).toBeNull();
  });

  it('returns the attribution for a valid guest', () => {
    expect(resolveGuestAttribution(guest)).toEqual(guest);
  });

  it('returns a valid guest even without an external URL (text render)', () => {
    const noUrl: Attribution = {
      hostGuest: 'guest',
      externalHost: 'FrankenJS',
      platform: 'Meetup',
    };
    expect(resolveGuestAttribution(noUrl)).toEqual(noUrl);
  });

  it('returns null for a guest missing a non-empty host/platform', () => {
    expect(
      resolveGuestAttribution({
        hostGuest: 'guest',
        externalHost: '   ',
        platform: 'YouTube',
      }),
    ).toBeNull();
    expect(
      resolveGuestAttribution({ hostGuest: 'guest', externalHost: 'X' }),
    ).toBeNull();
  });
});
