import type { CollectionEntry } from 'astro:content';

import { sortResourcesByEffectiveDate } from '../../lib/cross-links';
import { classify, type EventDate } from '../../schema/event-date';
import { comparePastEvents, compareUpcomingEvents } from '../events/eventMeta';

type EventEntry = CollectionEntry<'events'>;
type ResourceEntry = CollectionEntry<'resources'>;

/**
 * Homepage promo strip selection (FR-14/FR-15, Epic 10 — CAP-4). Composes the
 * near-term Upcoming Events plus the single latest Resource so the front door
 * proves the project is active.
 *
 * PURE by contract, mirroring the guarantee `src/lib/cross-links.ts` documents
 * for itself: this module never calls `getCollection`/`getEntry` — the caller
 * (`PromoStrip.astro`) passes the already-loaded arrays in — and `buildDate` is
 * an explicit parameter, never `new Date()`. That keeps this module unit
 * testable with fake entries and no content fixtures, and keeps NFR-7
 * (build-time freshness bound) anchored to a single clock read at the call
 * site instead of scattered across this module.
 */

/**
 * Cap on the number of Upcoming Event cards the strip surfaces. A CAP, never a
 * fill target: with fewer Upcoming Events than this, the strip shows fewer
 * cards — it is never topped up from Past.
 */
export const PROMO_EVENT_LIMIT = 3;

/**
 * Which FR-15 arm produced a {@link PromoSelection}: `upcoming` when ≥1
 * Upcoming Event exists; `past` when 0 Upcoming but ≥1 Past Event, or when 0
 * Events but ≥1 Resource; `evergreen` only when both collections are empty.
 */
export type PromoBranch = 'upcoming' | 'past' | 'evergreen';

/** The strip's composed selection for one build. */
export interface PromoSelection {
  branch: PromoBranch;
  /**
   * ≤ `PROMO_EVENT_LIMIT`, pre-ordered (nearest-first on 'upcoming',
   * most-recent-first on 'past'). Empty on the 'evergreen' branch and on the
   * 'past' branch's Resource-only variant (0 Events, ≥1 Resource).
   */
  events: EventEntry[];
  /** The single latest Resource, independent of the event branch; `undefined` when none exists. */
  latestResource: ResourceEntry | undefined;
}

/**
 * Compose the promo strip's selection for one build.
 *
 * Classification and ordering are entirely delegated — this function adds no
 * new date logic or comparator:
 *  - Upcoming/Past split → {@link classify} (`src/schema/event-date.ts`).
 *  - Upcoming order (nearest-first, TBA last, A→Z title tiebreak) →
 *    `compareUpcomingEvents` (`src/components/events/eventMeta.ts`).
 *  - Latest Resource → `sortResourcesByEffectiveDate(allResources,
 *    eventsById)[0]` (`src/lib/cross-links.ts`), run over the FULL resource set
 *    in one call (never pre-filtered) so the AD-6 dangling-`originEvent` guard
 *    in `resolveOriginEvent` stays exercised on this path too.
 *
 * The latest Resource is resolved independently of the event branch: per
 * FR-15, 0 Upcoming Events + ≥1 Resource is NOT the evergreen case (a
 * resource-only site still shows its latest Resource), so `latestResource` is
 * never gated on `events.length`.
 *
 * Full FR-15 precedence: (1) ≥1 Upcoming → `'upcoming'`, ≤`limit`
 * nearest-first; (2) 0 Upcoming, ≥1 Past → `'past'`, ≤`limit`
 * most-recent-first via `comparePastEvents`; (3) 0 Events, ≥1 Resource →
 * `'past'`, `events: []`; (4) 0 Events and 0 Resources → `'evergreen'`,
 * `events: []`. The Past arm is an `else`, never a top-up: a single Upcoming
 * Event is never padded from Past to reach `limit`.
 */
export function selectPromoItems(
  allEvents: EventEntry[],
  allResources: ResourceEntry[],
  eventsById: Map<string, EventEntry>,
  buildDate: Date,
  limit = PROMO_EVENT_LIMIT,
): PromoSelection {
  const latestResource = sortResourcesByEffectiveDate(
    allResources,
    eventsById,
  )[0];

  const upcoming = allEvents.filter(
    (event) => classify(event.data.date as EventDate, buildDate) === 'upcoming',
  );

  if (upcoming.length === 0) {
    const past = allEvents.filter(
      (event) => classify(event.data.date as EventDate, buildDate) === 'past',
    );

    if (past.length === 0) {
      // 0 Events total: a Resource-only site is still 'past' (FR-15 row 3),
      // never 'evergreen' — that branch is the true zero-content floor (row
      // 4), reached only when allResources is ALSO empty.
      return {
        branch: allResources.length === 0 ? 'evergreen' : 'past',
        events: [],
        latestResource,
      };
    }

    const events = past
      .sort((a, b) =>
        comparePastEvents(
          { date: a.data.date as EventDate, title: a.data.title },
          { date: b.data.date as EventDate, title: b.data.title },
        ),
      )
      .slice(0, limit);

    return { branch: 'past', events, latestResource };
  }

  const events = upcoming
    .sort((a, b) =>
      compareUpcomingEvents(
        { date: a.data.date as EventDate, title: a.data.title },
        { date: b.data.date as EventDate, title: b.data.title },
      ),
    )
    .slice(0, limit);

  return { branch: 'upcoming', events, latestResource };
}
