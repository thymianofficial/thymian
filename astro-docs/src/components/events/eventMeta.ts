import type { Attribution } from '../../schema/attribution';
import {
  comparePast,
  compareUpcoming,
  type EventDate,
} from '../../schema/event-date';
import {
  PARTICIPATION_TYPES,
  type ParticipationMode,
  type ParticipationType,
} from '../../schema/events';

/** Display labels for each participation type (also the filter-pill labels). */
export const PARTICIPATION_TYPE_LABELS = {
  talk: 'Talk',
  livestream: 'Livestream',
  podcast: 'Podcast',
  booth: 'Booth',
  paper: 'Paper',
  panel: 'Panel',
} satisfies Record<ParticipationType, string>;

/**
 * The OG-image page map for the Events section, keyed by each page's
 * `starlightRoute.id` (the value `route-data.ts` reads). Events render as inline
 * cards on a fixed page set — the `/events/` index (`events`) plus one page per
 * participation type (`events/type/<type>`) — so the keys are these PAGE ids, not
 * per-event-entry ids. The type-page keys are derived from `PARTICIPATION_TYPES`
 * + labels — the same source `[type].astro`'s `getStaticPaths` routes from — so
 * they track the type-page inventory automatically (adding/removing a type keeps
 * both in lockstep). The `events` index key is fixed, matching the static
 * `/events/` route. Consumed by `src/pages/og/[...route].ts`.
 */
export function eventOgPages(): Record<
  string,
  { title: string; description: string }
> {
  const pages: Record<string, { title: string; description: string }> = {
    events: {
      title: 'Events',
      description:
        'Where Thymian is speaking, exhibiting, and appearing — upcoming and past.',
    },
  };
  for (const type of PARTICIPATION_TYPES) {
    pages[`events/type/${type}`] = {
      title: `Events — ${PARTICIPATION_TYPE_LABELS[type]}`,
      description: `Thymian ${PARTICIPATION_TYPE_LABELS[type].toLowerCase()} appearances — upcoming and past.`,
    };
  }
  return pages;
}

/** Display labels for presenting vs attending. */
export const PARTICIPATION_MODE_LABELS = {
  presenting: 'Presenting',
  attending: 'Attending',
} satisfies Record<ParticipationMode, string>;

/** Canonical display / filter order for participation types (the enum tuple). */
export const PARTICIPATION_TYPE_ORDER = PARTICIPATION_TYPES;

/** Minimal shape the tiebreak comparators need — testable without content entries. */
export interface SortableEvent {
  date: EventDate;
  title: string;
}

/** Upcoming order: shared ascending/TBA-last comparator, then title A→Z. */
export function compareUpcomingEvents(
  a: SortableEvent,
  b: SortableEvent,
): number {
  const d = compareUpcoming(a.date, b.date);
  return d !== 0 ? d : a.title.localeCompare(b.title, 'en');
}

/** Past order: shared descending comparator, then title A→Z. */
export function comparePastEvents(a: SortableEvent, b: SortableEvent): number {
  const d = comparePast(a.date, b.date);
  return d !== 0 ? d : a.title.localeCompare(b.title, 'en');
}

/** A single call-to-action link surfaced on an event card. */
export interface EventCardLink {
  label: string;
  url: string;
}

/**
 * Resolve the time-relative CTA links for an event card. Register is
 * Upcoming-only; Resource is Past-only. Each link is surfaced only when its
 * field holds a non-empty (trimmed) URL — no empty affordance otherwise.
 */
export function resolveEventLinks(input: {
  timeframe: 'upcoming' | 'past';
  registerUrl?: string;
  resourceUrl?: string;
}): EventCardLink[] {
  const { timeframe, registerUrl, resourceUrl } = input;
  if (timeframe === 'upcoming') {
    const url = registerUrl?.trim();
    return url ? [{ label: 'Register to attend', url }] : [];
  }
  if (timeframe === 'past') {
    const url = resourceUrl?.trim();
    return url ? [{ label: 'View resource', url }] : [];
  }
  return [];
}

/**
 * Guest attribution to render, or `null` when nothing should be shown.
 *
 * AD-13 (honest attribution): a Host event (or an absent attribution) has no
 * external host to credit, so this returns `null` and the card emits no
 * attribution markup. A Guest is surfaced only when it actually names a
 * non-empty external host and platform — the schema refine guarantees this for
 * Epic 8 content, and this guard keeps the invariant safe for reuse (Epic 9)
 * even if a caller's data skipped that validation.
 */
export function resolveGuestAttribution(
  attribution?: Attribution,
): Attribution | null {
  if (attribution === undefined || attribution.hostGuest !== 'guest') {
    return null;
  }
  const hasHost =
    attribution.externalHost !== undefined &&
    attribution.externalHost.trim().length > 0;
  const hasPlatform =
    attribution.platform !== undefined &&
    attribution.platform.trim().length > 0;
  return hasHost && hasPlatform ? attribution : null;
}

/**
 * The brand identity to surface for an event's logo/lockup. A valid Guest
 * appearance credits the external host that owns the stage (honest attribution),
 * so its `externalHost` is the brand; otherwise (Host or absent/invalid guest)
 * the event's own `title` is the brand. The result is trimmed so a
 * whitespace-padded host/title never leaks into the visible label or alt text.
 */
export function resolveEventBrand(input: {
  title: string;
  attribution?: Attribution;
}): string {
  const { title, attribution } = input;
  return (resolveGuestAttribution(attribution)?.externalHost ?? title).trim();
}

/**
 * The `alt` text for an event logo — the mandatory, meaningful description
 * `<Image>` requires — derived from the already-resolved brand
 * (`"<brand> logo"`). This is the single source of truth for the alt format;
 * `EventLogo.astro` renders it directly.
 */
export function resolveLogoAlt(brand: string): string {
  return `${brand} logo`;
}
