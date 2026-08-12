import type { ImageMetadata } from 'astro'; // NOT from 'astro:assets' — that
// module exports the `Image` component, not the type.
import type { CollectionEntry } from 'astro:content';

import {
  type LogoCredit,
  PARTICIPATION_TYPE_LABELS,
  resolveEventBrand,
  resolveLogoAlt,
  resolveLogoCredits,
} from '../components/events/eventMeta';
import {
  resolveGuestAttribution,
  RESOURCE_TYPE_LABELS,
} from '../components/resources/resourceMeta';
import { type EventDate, formatDisplay } from '../schema/event-date';
import { resolveOriginEvent } from './cross-links';

/**
 * The single module that resolves a promo post's branded image (AD-14): the
 * Event's own logo when it has one — or, for a Resource, its Origin Event's
 * logo when that Event has one — otherwise a generated `SocialImage` branded
 * card. `PromoImage.astro` renders whichever branch this returns; no other
 * surface may re-derive the choice — AD-14 exists precisely to stop the hub
 * and the promo strip picking images differently.
 *
 * PURE by contract, in the words `src/lib/cross-links.ts` uses for itself:
 * this module never calls `getCollection`/`getEntry` — callers pass the
 * already-loaded entry and `eventsById` map in — so it stays unit-testable
 * with fake entries and no content fixtures.
 *
 * `resolvePromoImage` takes exactly TWO parameters — no `platform`, not even
 * an optional one "for later": AD-14 mandates ONE image reference per entry
 * across all four platforms, never per-platform sizing.
 *
 * The only license-cleared launch logo (FrosCon's) is CC BY-ND 3.0 DE —
 * NoDerivatives. The `logo` branch therefore hands back the `ImageMetadata`
 * completely unmodified — never composited into the card, recolored,
 * cropped, or filtered. The two branches are mutually exclusive: a logo is
 * used INSTEAD OF the card, never inside it.
 */

type EventEntry = CollectionEntry<'events'>;
type ResourceEntry = CollectionEntry<'resources'>;

export type PromoImageResult =
  | {
      kind: 'logo';
      image: ImageMetadata;
      brand: string;
      alt: string;
      credit: LogoCredit | undefined;
    }
  | { kind: 'card'; headline: string; subheadline: string };

/** Join non-empty (trimmed) fragments with `' · '`, filtering BEFORE joining
 * so an omitted/blank fragment can never leave a doubled or trailing
 * separator (AC5). */
function joinFragments(fragments: (string | undefined)[]): string {
  return fragments
    .filter((f): f is string => f !== undefined && f.trim().length > 0)
    .join(' · ');
}

/**
 * The card branch's subheadline for an Event: participation label, display
 * date, and place — every derivation delegated (`PARTICIPATION_TYPE_LABELS`,
 * `formatDisplay`), nothing re-derived here but the place fragment (a fourth
 * inlined copy of the same physical-XOR-online formatter as `EventCard.astro`
 * / `PromoStrip.astro` / `promo-post.ts`).
 */
function eventSubheadline(event: EventEntry): string {
  const { participation, date, online, location } = event.data;
  // `location` is typed `string | undefined` even though the schema `.refine`
  // guarantees physical-XOR-online at runtime — narrow explicitly, or `astro
  // check` fails under strict TS on the `online === true` branch.
  const place = online === true ? 'Online' : (location ?? '');
  return joinFragments([
    PARTICIPATION_TYPE_LABELS[participation],
    formatDisplay(date as EventDate),
    place,
  ]);
}

/**
 * The card branch's subheadline for a Resource: type label plus an omitted-
 * unless-present guest credit, mirroring `ResourceAttribution.astro`'s
 * rendered "Guest of … on …" wording (never inventing new copy).
 */
function resourceSubheadline(resource: ResourceEntry): string {
  const { resourceType, attribution } = resource.data;
  const guest = resolveGuestAttribution(attribution);
  const guestCredit = guest
    ? `Guest of ${guest.externalHost} on ${guest.platform}`
    : undefined;
  return joinFragments([RESOURCE_TYPE_LABELS[resourceType], guestCredit]);
}

/**
 * The `logo` branch result for a resolved logo-bearing Event. `logoEvent` is
 * the Event that actually supplies the asset — for an inherited Resource
 * logo, that is its Origin Event, never the Resource itself, so the licence
 * lookup (AC7) always keys off the right entry id.
 */
function logoResult(
  logoEvent: EventEntry,
  image: ImageMetadata,
): PromoImageResult {
  const brand = resolveEventBrand({
    title: logoEvent.data.title,
    attribution: logoEvent.data.attribution,
  });
  return {
    kind: 'logo',
    image,
    brand,
    alt: resolveLogoAlt(brand),
    credit: resolveLogoCredits([logoEvent])[0],
  };
}

/**
 * Resolve the branded image for one Event or Resource entry (AD-14).
 *
 * - An Event with `data.logo` set → `kind: 'logo'` for its own logo.
 * - A Resource resolves through its Origin Event via `resolveOriginEvent`
 *   (`src/lib/cross-links.ts`) — the SAME AD-6 dangling-reference guard #447
 *   uses. That call is never wrapped in try/catch, never pre-filtered, and
 *   never reimplemented with `eventsById.get(...)` directly: Astro 7.1.3's
 *   `reference()` is warn-only, so this throw is the only thing that fails
 *   the build on a dangling `originEvent`.
 * - Anything else (no logo reachable) → `kind: 'card'`.
 */
export function resolvePromoImage(
  entry: CollectionEntry<'events'> | CollectionEntry<'resources'>,
  eventsById: Map<string, CollectionEntry<'events'>>,
): PromoImageResult {
  if (entry.collection === 'events') {
    const { logo } = entry.data;
    if (logo !== undefined) {
      return logoResult(entry, logo);
    }
    return {
      kind: 'card',
      headline: entry.data.title,
      subheadline: eventSubheadline(entry),
    };
  }

  const originEvent = resolveOriginEvent(entry, eventsById);
  const inheritedLogo = originEvent?.data.logo;
  if (originEvent !== undefined && inheritedLogo !== undefined) {
    return logoResult(originEvent, inheritedLogo);
  }
  return {
    kind: 'card',
    headline: entry.data.title,
    subheadline: resourceSubheadline(entry),
  };
}
