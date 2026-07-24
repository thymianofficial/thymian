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
