import type { CollectionEntry } from 'astro:content';

/**
 * The pure entry -> route mapping for the Epic 11 hub (Story 11.3, AC1/AC13).
 *
 * PURE by contract, in the words `src/lib/cross-links.ts` uses for itself:
 * this module never calls `getCollection`/`getEntry`, never reads the clock,
 * and never reads `Astro.*` — callers pass the already-loaded entry in, so
 * it stays unit-testable with fake entries and no content fixtures.
 *
 * `cross-links.ts` declares its own `EventEntry`/`ResourceEntry` aliases
 * module-locally and exports neither, so this module declares its own local
 * aliases below rather than importing them. The union type is named
 * `HubPathEntry`, not `HubEntry`, so it never collides with the sibling
 * `HubEntry.astro` component.
 */

type EventEntry = CollectionEntry<'events'>;
type ResourceEntry = CollectionEntry<'resources'>;

/** Either collection this hub route serves. */
export type HubPathEntry = EventEntry | ResourceEntry;

/** The dynamic route params for one entry's per-entry hub page. */
export interface HubParams {
  collection: HubPathEntry['collection'];
  entry: string;
}

/**
 * The `[collection]`/`[entry]` route params for one entry — consumed both by
 * `getStaticPaths` (`src/pages/social/events-resources/[collection]/[entry].astro`)
 * and by {@link hubPathForEntry} below, so the two can never drift apart.
 */
export function hubParamsForEntry(entry: HubPathEntry): HubParams {
  return { collection: entry.collection, entry: entry.id };
}

/**
 * The absolute, trailing-slash path to one entry's per-entry hub page:
 * `/social/events-resources/<collection>/<id>/`. The `collection` segment is
 * required — entry ids are unique only *within* a collection (both content
 * dirs are flat), so a flat `[entry]` scheme would be a latent collision.
 * Never a `#` fragment.
 */
export function hubPathForEntry(entry: HubPathEntry): string {
  const { collection, entry: id } = hubParamsForEntry(entry);
  return `/social/events-resources/${collection}/${id}/`;
}
