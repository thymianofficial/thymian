import { RESOURCE_TYPES, type ResourceType } from '../../schema/resources';

/**
 * Reuse the Events AD-13 honest-attribution guard verbatim — a Resource has the
 * exact same Host/Guest attribution shape, so re-exporting keeps a single source
 * of truth (never re-implement the branch). Consumed by `ResourceAttribution`.
 */
export { resolveGuestAttribution } from '../events/eventMeta';

/** Display labels for each resource type (also the filter-pill labels). */
export const RESOURCE_TYPE_LABELS = {
  'recorded talk': 'Recorded Talk',
  webinar: 'Webinar',
  'podcast episode': 'Podcast Episode',
  paper: 'Paper',
} satisfies Record<ResourceType, string>;

/** Canonical display / filter order for resource types (the enum tuple). */
export const RESOURCE_TYPE_ORDER = RESOURCE_TYPES;

/** Minimal shape the sort comparator needs — testable without content entries. */
export interface SortableResource {
  date?: Date;
  title: string;
}

/**
 * Library order: most-recent-first (descending by `date`), undated entries
 * bucketed LAST, then title A→Z tiebreak. The current 9.1 schema has no resource
 * date field, so the library feeds `date: undefined` and the shipped order falls
 * deterministically to title A→Z; 9.4 will feed the origin event's date without
 * changing this comparator.
 */
export function compareResources(
  a: SortableResource,
  b: SortableResource,
): number {
  // Normalise an Invalid Date (`getTime()` → NaN) to "undated" so it buckets
  // last instead of poisoning the comparator with a NaN return (which yields a
  // non-transitive, engine-defined order). Guards the 9.4 reuse seam.
  const toTime = (d?: Date): number | undefined => {
    const t = d?.getTime();
    return t === undefined || Number.isNaN(t) ? undefined : t;
  };
  const aTime = toTime(a.date);
  const bTime = toTime(b.date);
  if (aTime !== undefined && bTime !== undefined) {
    if (aTime !== bTime) {
      return bTime - aTime;
    }
  } else if (aTime !== undefined) {
    return -1;
  } else if (bTime !== undefined) {
    return 1;
  }
  return a.title.localeCompare(b.title, 'en');
}

/** URL-safe slug for a (possibly multi-word) resource type: spaces → hyphens. */
export function resourceTypeSlug(type: ResourceType): string {
  return type.replaceAll(' ', '-');
}

/** Inverse of {@link resourceTypeSlug}: a slug back to its enum value, or `undefined`. */
export function resourceTypeFromSlug(slug: string): ResourceType | undefined {
  return RESOURCE_TYPES.find((type) => resourceTypeSlug(type) === slug);
}
