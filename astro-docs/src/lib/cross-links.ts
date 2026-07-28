import type { CollectionEntry } from 'astro:content';

import { compareResources } from '../components/resources/resourceMeta';
import { effectiveDate } from '../schema/event-date';

/**
 * The single shared module owning the bidirectional Event↔Resource derivation
 * (Story 9.4). The relationship is authored ONLY as a Resource's `originEvent`;
 * the Event's produced-Resources list is DERIVED here at build time. Every
 * consumer (the Resource library, the Event page, the Epic 10 promo strip, the
 * Epic 11 hub) imports these functions so ordering and URL targets can never
 * drift.
 *
 * PURE by contract: this module never calls `getCollection`/`getEntry` — pages
 * pass the already-loaded arrays in — so it stays unit-testable with fake
 * entries and no content fixtures.
 */

type EventEntry = CollectionEntry<'events'>;
type ResourceEntry = CollectionEntry<'resources'>;

/** Index events by their entry `id` for O(1) origin-event resolution. */
export function indexEventsById(
  allEvents: EventEntry[],
): Map<string, EventEntry> {
  return new Map(allEvents.map((event) => [event.id, event]));
}

/**
 * The sole entry→URL map for cross-links. Neither collection has a per-entry
 * detail page (only an `index` + `type/[type]` route set), so both directions
 * resolve to their library index — a real route with NO `#` fragment, so
 * `starlight-links-validator` (with `errorOnInvalidHashes`) stays green. The
 * link's specific title carries the meaning despite the coarse target.
 */
export function urlForEntry(entry: EventEntry | ResourceEntry): string {
  return entry.collection === 'events' ? '/events/' : '/resources/';
}

/**
 * Resolve a resource's origin Event, or `undefined` when it has none.
 *
 * AD-6 build-time integrity guard: Astro 7.1.3 `reference('events')` is
 * WARN-ONLY — a dangling id yields `getEntry → undefined` and a console warning,
 * NOT a build failure. So when `originEvent` is SET but resolves to no existing
 * Event, this THROWS, failing `astro build` loudly rather than rendering a
 * silent broken link. Never swallow a dangling reference.
 */
export function resolveOriginEvent(
  resource: ResourceEntry,
  eventsById: Map<string, EventEntry>,
): EventEntry | undefined {
  const ref = resource.data.originEvent;
  if (ref === undefined) {
    return undefined;
  }
  const event = eventsById.get(ref.id);
  if (event === undefined) {
    throw new Error(
      `AD-6 build-time guard: resource '${resource.id}' has originEvent '${ref.id}', ` +
        `but no event with that id exists. Astro reference() is warn-only, so this ` +
        `would otherwise render a silent broken link — failing the build instead. ` +
        `Fix the originEvent id or add the missing event.`,
    );
  }
  return event;
}

/**
 * Run {@link resolveOriginEvent} across the FULL resource set so a dangling
 * reference is caught even when it matches no rendered event. Called explicitly
 * in both `/resources` pages — coverage never depends on a dangling ref
 * happening to line up with a surfaced event.
 */
export function assertOriginEventsResolve(
  allResources: ResourceEntry[],
  eventsById: Map<string, EventEntry>,
): void {
  for (const resource of allResources) {
    resolveOriginEvent(resource, eventsById);
  }
}

/**
 * A resource's effective date = its origin Event's `effectiveDate(date)`
 * (month→1st of month, TBA/none→undefined). Used purely as the sort basis; a
 * resource with no resolvable origin event is undated (buckets last).
 */
export function resourceEffectiveDate(
  resource: ResourceEntry,
  eventsById: Map<string, EventEntry>,
): Date | undefined {
  const event = resolveOriginEvent(resource, eventsById);
  return event ? (effectiveDate(event.data.date) ?? undefined) : undefined;
}

/**
 * Library order: most-recent-first by resource effective date (= origin-event
 * date), undated / no-origin-event entries bucketed last, title A→Z tiebreak.
 * Delegates to the shared `compareResources` comparator (never re-implement the
 * branch) by injecting each resource's effective date into its `date` slot.
 */
export function sortResourcesByEffectiveDate(
  resources: ResourceEntry[],
  eventsById: Map<string, EventEntry>,
): ResourceEntry[] {
  return [...resources].sort((a, b) =>
    compareResources(
      { title: a.data.title, date: resourceEffectiveDate(a, eventsById) },
      { title: b.data.title, date: resourceEffectiveDate(b, eventsById) },
    ),
  );
}

/**
 * The Resources an Event produced, DERIVED (never hand-authored) from every
 * resource whose `originEvent` names this event, sorted by the single shared
 * basis. Returns `[]` for an event no resource names (0..N cardinality).
 */
export function resourcesForEvent(
  eventId: string,
  allResources: ResourceEntry[],
  eventsById: Map<string, EventEntry>,
): ResourceEntry[] {
  const produced = allResources.filter(
    (resource) => resource.data.originEvent?.id === eventId,
  );
  return sortResourcesByEffectiveDate(produced, eventsById);
}
