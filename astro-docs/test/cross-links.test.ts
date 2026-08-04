import type { CollectionEntry } from 'astro:content';
import { describe, expect, it } from 'vitest';

import {
  assertOriginEventsResolve,
  indexEventsById,
  indexResourcesByOriginEvent,
  resolveOriginEvent,
  resourceEffectiveDate,
  resourcesForEvent,
  sortResourcesByEffectiveDate,
  urlForEntry,
} from '../src/lib/cross-links';
import type { EventDate } from '../src/schema/event-date';

// Fake entries — mirror the resources-meta.test.ts idiom (build the minimal
// shape the pure functions read, cast through `unknown`). No content fixtures.
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

describe('urlForEntry', () => {
  it('maps an event to the events library index', () => {
    expect(urlForEntry(event('e', exact('2026-08-01')))).toBe('/events/');
  });

  it('maps a resource to the resources library index', () => {
    expect(urlForEntry(resource('r', 'R', 'e'))).toBe('/resources/');
  });
});

describe('resolveOriginEvent (AD-6 throwing primitive)', () => {
  const evAug = event('aug', exact('2026-08-01'));
  const eventsById = indexEventsById([evAug]);

  it('resolves a set, existing originEvent to its entry', () => {
    expect(resolveOriginEvent(resource('r', 'R', 'aug'), eventsById)).toBe(
      evAug,
    );
  });

  it('returns undefined when originEvent is unset', () => {
    expect(resolveOriginEvent(resource('r', 'R'), eventsById)).toBeUndefined();
  });

  it('THROWS on a dangling originEvent (warn-only reference safety net)', () => {
    expect(() =>
      resolveOriginEvent(resource('r', 'R', 'ghost'), eventsById),
    ).toThrow(/ghost/);
  });
});

describe('assertOriginEventsResolve', () => {
  const eventsById = indexEventsById([event('aug', exact('2026-08-01'))]);

  it('passes a set with only resolvable / unset originEvents', () => {
    expect(() =>
      assertOriginEventsResolve(
        [resource('a', 'A', 'aug'), resource('b', 'B')],
        eventsById,
      ),
    ).not.toThrow();
  });

  it('throws on the first dangling resource in the set', () => {
    expect(() =>
      assertOriginEventsResolve(
        [resource('a', 'A', 'aug'), resource('c', 'C', 'ghost')],
        eventsById,
      ),
    ).toThrow(/ghost/);
  });
});

describe('resourceEffectiveDate', () => {
  const eventsById = indexEventsById([
    event('aug', exact('2026-08-01')),
    event('tba', { precision: 'tba' }),
    event('month', { precision: 'month', year: 2026, month: 7 }),
  ]);

  it('is the origin event exact date', () => {
    expect(
      resourceEffectiveDate(resource('r', 'R', 'aug'), eventsById),
    ).toEqual(new Date('2026-08-01'));
  });

  it('resolves a month-precision origin event to the 1st of the month (UTC)', () => {
    expect(
      resourceEffectiveDate(resource('r', 'R', 'month'), eventsById),
    ).toEqual(new Date(Date.UTC(2026, 6, 1)));
  });

  it('is undefined for a TBA origin event', () => {
    expect(
      resourceEffectiveDate(resource('r', 'R', 'tba'), eventsById),
    ).toBeUndefined();
  });

  it('is undefined when there is no origin event', () => {
    expect(
      resourceEffectiveDate(resource('r', 'R'), eventsById),
    ).toBeUndefined();
  });
});

describe('sortResourcesByEffectiveDate', () => {
  const eventsById = indexEventsById([
    event('aug', exact('2026-08-01')),
    event('jul', exact('2026-07-01')),
    event('tba', { precision: 'tba' }),
  ]);

  it('orders most-recent-first by origin-event effective date', () => {
    const sorted = sortResourcesByEffectiveDate(
      [resource('r1', 'July talk', 'jul'), resource('r2', 'Aug talk', 'aug')],
      eventsById,
    );
    expect(sorted.map((r) => r.data.title)).toEqual(['Aug talk', 'July talk']);
  });

  it('buckets TBA-origin and no-origin resources last, title A→Z within', () => {
    const sorted = sortResourcesByEffectiveDate(
      [
        resource('r-tba', 'Zed undated', 'tba'),
        resource('r-none', 'Alpha undated'),
        resource('r-aug', 'Aug talk', 'aug'),
      ],
      eventsById,
    );
    expect(sorted.map((r) => r.data.title)).toEqual([
      'Aug talk',
      'Alpha undated',
      'Zed undated',
    ]);
  });

  it('breaks a same-effective-date tie by title A→Z', () => {
    const eq = indexEventsById([event('same', exact('2026-08-01'))]);
    const sorted = sortResourcesByEffectiveDate(
      [
        resource('z', 'Zeta', 'same'),
        resource('a', 'Alpha', 'same'),
        resource('m', 'Mike', 'same'),
      ],
      eq,
    );
    expect(sorted.map((r) => r.data.title)).toEqual(['Alpha', 'Mike', 'Zeta']);
  });

  it('does not mutate the input array', () => {
    const input = [resource('r2', 'Aug', 'aug'), resource('r1', 'Jul', 'jul')];
    sortResourcesByEffectiveDate(input, eventsById);
    expect(input.map((r) => r.id)).toEqual(['r2', 'r1']);
  });
});

describe('resourcesForEvent (derived, filter + sort + cardinality)', () => {
  const eventsById = indexEventsById([
    event('conf', exact('2026-08-01')),
    event('meetup', exact('2026-07-01')),
  ]);
  const allResources = [
    resource('talk-a', 'Zeta from conf', 'conf'),
    resource('talk-b', 'Alpha from conf', 'conf'),
    resource('talk-c', 'From meetup', 'meetup'),
    resource('orphan', 'No origin'),
  ];

  it('returns only resources naming the event, sorted (same date → title A→Z)', () => {
    const produced = resourcesForEvent('conf', allResources, eventsById);
    expect(produced.map((r) => r.data.title)).toEqual([
      'Alpha from conf',
      'Zeta from conf',
    ]);
  });

  it('returns exactly one for an event named by a single resource', () => {
    const produced = resourcesForEvent('meetup', allResources, eventsById);
    expect(produced.map((r) => r.id)).toEqual(['talk-c']);
  });

  it('returns [] for an event no resource names (0 cardinality)', () => {
    expect(resourcesForEvent('conf', [], eventsById)).toEqual([]);
    expect(resourcesForEvent('unlinked', allResources, eventsById)).toEqual([]);
  });
});

describe('indexResourcesByOriginEvent (one-pass grouping for list pages)', () => {
  const eventsById = indexEventsById([
    event('conf', exact('2026-08-01')),
    event('meetup', exact('2026-07-01')),
  ]);
  const allResources = [
    resource('talk-a', 'Zeta from conf', 'conf'),
    resource('talk-b', 'Alpha from conf', 'conf'),
    resource('talk-c', 'From meetup', 'meetup'),
    resource('orphan', 'No origin'),
  ];

  it('groups every linked resource under its origin event, each group sorted', () => {
    const byEvent = indexResourcesByOriginEvent(allResources, eventsById);
    expect(byEvent.get('conf')?.map((r) => r.data.title)).toEqual([
      'Alpha from conf',
      'Zeta from conf',
    ]);
    expect(byEvent.get('meetup')?.map((r) => r.id)).toEqual(['talk-c']);
  });

  it('has no entry for an unlinked event and never groups origin-less resources', () => {
    const byEvent = indexResourcesByOriginEvent(allResources, eventsById);
    expect(byEvent.has('unlinked')).toBe(false);
    expect([...byEvent.values()].flat().map((r) => r.id)).not.toContain(
      'orphan',
    );
  });

  it('agrees with the single-event query for every event', () => {
    const byEvent = indexResourcesByOriginEvent(allResources, eventsById);
    for (const id of ['conf', 'meetup']) {
      expect(byEvent.get(id)).toEqual(
        resourcesForEvent(id, allResources, eventsById),
      );
    }
  });
});
