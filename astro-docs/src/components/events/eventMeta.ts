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
