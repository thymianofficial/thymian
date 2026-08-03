import type { CollectionEntry } from 'astro:content';
import { describe, expect, it } from 'vitest';

import {
  PROMO_EVENT_LIMIT,
  selectPromoItems,
} from '../src/components/promo-strip/promoStripMeta';
import { indexEventsById } from '../src/lib/cross-links';
import type { EventDate } from '../src/schema/event-date';

// Fake entries — mirror the `event()`/`resource()` idiom in
// `test/cross-links.test.ts`: minimal object literals cast through `unknown`.
// No content fixtures.
type EventEntry = CollectionEntry<'events'>;
type ResourceEntry = CollectionEntry<'resources'>;

function event(id: string, date: EventDate, title = id): EventEntry {
  return {
    id,
    collection: 'events',
    data: { title, date },
  } as unknown as EventEntry;
}

function resource(
  id: string,
  title: string,
  originEventId?: string,
): ResourceEntry {
  return {
    id,
    collection: 'resources',
    data: {
      title,
      originEvent:
        originEventId === undefined
          ? undefined
          : { collection: 'events', id: originEventId },
    },
  } as unknown as ResourceEntry;
}

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

// A fixed build date — `selectPromoItems` must never depend on the real clock.
const BUILD_DATE = new Date('2026-08-03');

describe('PROMO_EVENT_LIMIT', () => {
  it('is the cap of 3', () => {
    expect(PROMO_EVENT_LIMIT).toBe(3);
  });
});

describe('selectPromoItems — upcoming branch (Story 10.1 scope)', () => {
  it('caps at PROMO_EVENT_LIMIT (3), nearest-first, when more than 3 are Upcoming', () => {
    const events = [
      event('e5', exact('2026-12-01'), 'December'),
      event('e1', exact('2026-08-15'), 'August'),
      event('e4', exact('2026-11-01'), 'November'),
      event('e2', exact('2026-09-15'), 'September'),
      event('e3', exact('2026-10-01'), 'October'),
    ];
    const eventsById = indexEventsById(events);
    const result = selectPromoItems(events, [], eventsById, BUILD_DATE);

    expect(result.branch).toBe('upcoming');
    expect(result.events).toHaveLength(3);
    expect(result.events.map((e) => e.data.title)).toEqual([
      'August',
      'September',
      'October',
    ]);
  });

  it('never backfills the cap from Past: 2 Upcoming + 3 Past returns exactly 2', () => {
    const events = [
      event('u1', exact('2026-08-15'), 'Upcoming A'),
      event('u2', exact('2026-09-01'), 'Upcoming B'),
      event('p1', exact('2026-07-01'), 'Past A'),
      event('p2', exact('2026-06-01'), 'Past B'),
      event('p3', exact('2024-10-23'), 'Past C'),
    ];
    const eventsById = indexEventsById(events);
    const result = selectPromoItems(events, [], eventsById, BUILD_DATE);

    expect(result.events).toHaveLength(2);
    expect(result.events.map((e) => e.id).sort()).toEqual(['u1', 'u2']);
  });

  it('breaks a same-calendar-day tie by title A→Z', () => {
    const events = [
      event('z', exact('2026-09-15'), 'Zeta'),
      event('a', exact('2026-09-15'), 'Alpha'),
    ];
    const eventsById = indexEventsById(events);
    const result = selectPromoItems(events, [], eventsById, BUILD_DATE);

    expect(result.events.map((e) => e.data.title)).toEqual(['Alpha', 'Zeta']);
  });

  it('counts a TBA event as Upcoming and sorts it last', () => {
    const events = [
      event('tba-event', tba, 'TBA Talk'),
      event('dated', exact('2026-08-15'), 'Dated Talk'),
    ];
    const eventsById = indexEventsById(events);
    const result = selectPromoItems(events, [], eventsById, BUILD_DATE);

    expect(result.events.map((e) => e.data.title)).toEqual([
      'Dated Talk',
      'TBA Talk',
    ]);
  });

  it('resolves month precision to the 1st of the month for classify (delegated, not reimplemented)', () => {
    const events = [event('sept', month(2026, 9), 'September Panel')];
    const eventsById = indexEventsById(events);

    // Effective date = 2026-09-01. A build date the day after is already Past.
    const past = selectPromoItems(
      events,
      [],
      eventsById,
      new Date('2026-09-02'),
    );
    expect(past.events).toEqual([]);

    // A build date before the 1st is still Upcoming.
    const upcoming = selectPromoItems(
      events,
      [],
      eventsById,
      new Date('2026-08-31'),
    );
    expect(upcoming.events.map((e) => e.id)).toEqual(['sept']);
  });

  it('honors a custom limit override', () => {
    const events = [
      event('e1', exact('2026-08-15'), 'August'),
      event('e2', exact('2026-09-15'), 'September'),
      event('e3', exact('2026-10-15'), 'October'),
    ];
    const eventsById = indexEventsById(events);
    const result = selectPromoItems(events, [], eventsById, BUILD_DATE, 1);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.id).toBe('e1');
  });
});

describe('selectPromoItems — 0 Upcoming Events (10.2 boundary; must not throw)', () => {
  it('returns branch "upcoming" with an empty events array when every event is Past', () => {
    const events = [event('p1', exact('2024-10-23'), 'FrankenJS')];
    const eventsById = indexEventsById(events);
    const result = selectPromoItems(events, [], eventsById, BUILD_DATE);

    expect(result).toEqual({
      branch: 'upcoming',
      events: [],
      latestResource: undefined,
    });
  });

  it('returns branch "upcoming" with an empty events array when there are no events at all', () => {
    const result = selectPromoItems([], [], new Map(), BUILD_DATE);

    expect(result.branch).toBe('upcoming');
    expect(result.events).toEqual([]);
  });

  it('still resolves latestResource with 0 Upcoming Events (FR-15 asymmetry: resource-only is not evergreen)', () => {
    const events = [event('jul', exact('2026-07-10'), 'My Coding Zone')];
    const resources = [resource('rec', 'The Recording', 'jul')];
    const eventsById = indexEventsById(events);
    const result = selectPromoItems(events, resources, eventsById, BUILD_DATE);

    expect(result.events).toEqual([]);
    expect(result.latestResource?.id).toBe('rec');
  });
});

describe('selectPromoItems — latest Resource derivation (delegated, never re-derived)', () => {
  it('picks the most recent Resource by origin-Event effective date', () => {
    const events = [
      event('jul', exact('2026-07-10')),
      event('aug', exact('2026-08-15')),
    ];
    const resources = [
      resource('r-jul', 'July Recording', 'jul'),
      resource('r-aug', 'August Recording', 'aug'),
    ];
    const eventsById = indexEventsById(events);
    const result = selectPromoItems(events, resources, eventsById, BUILD_DATE);

    expect(result.latestResource?.id).toBe('r-aug');
  });

  it('buckets an undated (origin-less) Resource last, never picked over a dated one', () => {
    const events = [event('jul', exact('2026-07-10'))];
    const resources = [
      resource('undated', 'No Origin'),
      resource('dated', 'Has Origin', 'jul'),
    ];
    const eventsById = indexEventsById(events);
    const result = selectPromoItems(events, resources, eventsById, BUILD_DATE);

    expect(result.latestResource?.id).toBe('dated');
  });

  it('throws when a Resource has a dangling originEvent (AD-6 guard stays exercised)', () => {
    const events = [event('jul', exact('2026-07-10'))];
    const resources = [
      resource('ok', 'Fine', 'jul'),
      resource('ghost', 'Dangling', 'nonexistent'),
    ];
    const eventsById = indexEventsById(events);

    expect(() =>
      selectPromoItems(events, resources, eventsById, BUILD_DATE),
    ).toThrow(/nonexistent/);
  });
});
