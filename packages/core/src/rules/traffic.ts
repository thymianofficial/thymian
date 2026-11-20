import type { HttpRequest, HttpResponse } from '../http.js';
import type { HttpParticipantRole } from './rule-meta.js';

/**
 * A part of a captured message the traffic source did not record, so its
 * absence from `data` must not be read as absence from the message.
 *
 * A closed union tagged by `kind`; further kinds widen it. Rules never read
 * the gaps themselves, they ask `isHeaderCaptured`. See ADR-0026
 * (`docs/arc42/adr/0026-capture-gaps-are-marked-on-the-captured-message.md`).
 *
 * - `headers-not-captured`: none of the message's header fields were recorded.
 */
export type CaptureGap = { kind: 'headers-not-captured' };

/** What a traffic source recorded about a captured message besides its data. */
export type CapturedMessageMeta = {
  /** The participant that sent this message. */
  role?: HttpParticipantRole;
  /** Parts of this message the traffic source did not record (ADR-0026). */
  captureGaps?: CaptureGap[];
};

export type CapturedHttpRequest = {
  data: HttpRequest;
  meta: CapturedMessageMeta;
};

export type CapturedHttpResponse = {
  data: HttpResponse;
  meta: CapturedMessageMeta;
};

export type CapturedTransaction = {
  request: CapturedHttpRequest;
  response: CapturedHttpResponse;
};

export type CapturedTrace = CapturedTransaction[];

export interface LoadedTraffic {
  transactions?: CapturedTransaction[];
  traces?: CapturedTrace[];
  metadata?: Record<string, unknown>;
}
