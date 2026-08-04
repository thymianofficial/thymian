import { RESOURCE_TYPES, type ResourceType } from '../../schema/resources';
import { resolvePlatformLabel } from '../events/eventMeta';
import { isHost } from '../hostMatch';

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

/**
 * The OG-image page map for the Resources section, keyed by each page's
 * `starlightRoute.id` (the value `route-data.ts` reads). Resources render as
 * inline cards on a fixed page set — the `/resources/` index (`resources`) plus
 * one page per resource type (`resources/type/<slug>`) — so the keys are these
 * PAGE ids, not per-resource-entry ids (AD-4). The type-page keys are derived
 * from `RESOURCE_TYPES` — the same source `[type].astro`'s `getStaticPaths`
 * routes from — so they track the type-page inventory automatically
 * (adding/removing a type keeps both in lockstep). Unlike `eventOgPages()`,
 * whose participation enum values are already URL-safe single words, resource
 * enum values are MULTI-WORD, so each type key MUST be slugged via
 * `resourceTypeSlug` to match the shipped route id. The `resources` index key is
 * fixed, matching the static `/resources/` route. Consumed by
 * `src/pages/og/[...route].ts`.
 */
export function resourceOgPages(): Record<
  string,
  { title: string; description: string }
> {
  const pages: Record<string, { title: string; description: string }> = {
    resources: {
      title: 'Resources',
      description:
        'Talks, webinars, podcast episodes, and papers Thymian produced or took part in.',
    },
  };
  for (const type of RESOURCE_TYPES) {
    pages[`resources/type/${resourceTypeSlug(type)}`] = {
      title: `Resources — ${RESOURCE_TYPE_LABELS[type]}`,
      description: `Browse Thymian ${RESOURCE_TYPE_LABELS[type].toLowerCase()} resources.`,
    };
  }
  return pages;
}

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

/**
 * The render decision for a resource's media surface (AD-12): an inline embed
 * with a build-derived, known-safe `src` (plus an always-available external
 * `fallback` link — the AC3 fail-safe), or a safe external link-out. Exactly ONE
 * resolver (`resolveResourceEmbed`) produces this; consumers never re-implement
 * the embed-vs-link branch.
 */
export type ResourceEmbed =
  | {
      kind: 'embed';
      src: string;
      provider: string;
      title: string;
      fallback: { url: string; label: string };
    }
  | { kind: 'link'; url: string; label: string };

/** YouTube video ids are exactly 11 URL-safe base64 chars. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Derive a privacy-friendly YouTube embed `src` from an author URL, or
 * `undefined` when it is not a YouTube URL we can safely embed. Handles
 * `watch?v=`, `youtu.be/<id>`, `/embed/<id>`, `/shorts/<id>`, `/live/<id>`. The
 * extracted id must match {@link YOUTUBE_ID}; anything else → `undefined` (never
 * build a `src` from an unvalidated fragment). Host matching uses the secure
 * `isHost` boundary check, so `evilyoutube.com` is rejected.
 */
function youtubeEmbedSrc(parsed: URL): string | undefined {
  const host = parsed.hostname.toLowerCase();
  let id: string | undefined;
  if (host === 'youtu.be') {
    id = parsed.pathname.split('/').filter(Boolean)[0];
  } else if (isHost(host, 'youtube.com')) {
    const v = parsed.searchParams.get('v');
    if (v) {
      id = v;
    } else {
      const [segment, value] = parsed.pathname.split('/').filter(Boolean);
      if (segment === 'embed' || segment === 'shorts' || segment === 'live') {
        id = value;
      }
    }
  }
  if (id === undefined || !YOUTUBE_ID.test(id)) {
    return undefined;
  }
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

/**
 * Type-appropriate generic link-out labels — the fallback verb when the host is
 * not one `resolvePlatformLabel` recognises. A `paper` is read (never watched);
 * an audio `podcast episode` is listened to, not watched.
 */
const GENERIC_LINK_LABEL = {
  'recorded talk': 'Watch the recording',
  webinar: 'Watch the recording',
  'podcast episode': 'Listen to the episode',
  paper: 'Read the paper',
} satisfies Record<ResourceType, string>;

/**
 * A type-appropriate, human link-out label. Recognised video/audio platforms
 * reuse the shared `resolvePlatformLabel` host→label map ("Watch on YouTube",
 * "Listen on Spotify", …); an unrecognised host signals structurally
 * (`undefined`) and falls to the type's {@link GENERIC_LINK_LABEL} — the
 * events-side "Watch…" generic would be the wrong verb for a `paper` or an
 * audio `podcast episode`. Papers never consult the platform map at all.
 */
function resolveResourceLinkLabel(type: ResourceType, url: string): string {
  if (type === 'paper') {
    return GENERIC_LINK_LABEL.paper;
  }
  return resolvePlatformLabel(url) ?? GENERIC_LINK_LABEL[type];
}

/**
 * THE single embed-vs-link resolver (AD-12 / FR-10). Decision order:
 *   (a) author declared non-embeddable OR a `paper` → link-out;
 *   (b) embeddable AND a recognised provider we can derive a known-safe embed
 *       URL for (currently YouTube → youtube-nocookie) → inline embed;
 *   (c) safe default → link-out (never iframe a host we cannot build a known
 *       embed URL for; malformed URLs fall here via try/catch — never throw).
 */
export function resolveResourceEmbed(input: {
  resourceType: ResourceType;
  url: string;
  embeddable: boolean;
  title: string;
}): ResourceEmbed {
  const { resourceType, url, embeddable, title } = input;
  const link = (): ResourceEmbed => ({
    kind: 'link',
    url,
    label: resolveResourceLinkLabel(resourceType, url),
  });

  if (!embeddable || resourceType === 'paper') {
    return link();
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return link();
  }

  const src = youtubeEmbedSrc(parsed);
  if (src !== undefined) {
    return {
      kind: 'embed',
      src,
      provider: 'youtube',
      title: `${title} — embedded player`,
      fallback: { url, label: resolveResourceLinkLabel(resourceType, url) },
    };
  }
  return link();
}
