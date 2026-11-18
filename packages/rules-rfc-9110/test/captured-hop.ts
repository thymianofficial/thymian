import type {
  CapturedTransaction,
  CaptureGap,
  HttpParticipantRole,
} from '@thymian/core';

/** Marks a message whose header fields were not recorded (ADR-0026). */
export const NOT_CAPTURED: CaptureGap[] = [{ kind: 'headers-not-captured' }];

export type HopOptions = {
  /** The message `headers`, `body` and `captureGaps` go on; the other has none. */
  side?: 'request' | 'response';
  method?: string;
  body?: string;
  statusCode?: number;
  captureGaps?: CaptureGap[];
};

/**
 * One recorded hop from `from` to `to`. `meta.role` names the participant
 * that sent each message, so the request carries `from` and the response
 * `to`, as in recorded traffic.
 */
export function hop(
  from: HttpParticipantRole,
  to: HttpParticipantRole,
  headers: Record<string, string | string[] | undefined>,
  {
    side = 'request',
    method = 'get',
    body,
    statusCode = 200,
    captureGaps,
  }: HopOptions = {},
): CapturedTransaction {
  const isSide = (s: 'request' | 'response') => side === s;
  const gaps = captureGaps && { captureGaps };
  return {
    request: {
      data: {
        method,
        origin: 'https://example.com',
        path: '/',
        headers: isSide('request') ? headers : {},
        body: isSide('request') ? body : undefined,
      },
      meta: { role: from, ...(isSide('request') && gaps) },
    },
    response: {
      data: {
        statusCode,
        headers: isSide('response') ? headers : {},
        body: isSide('response') ? body : undefined,
        trailers: {},
        duration: 1,
      },
      meta: { role: to, ...(isSide('response') && gaps) },
    },
  };
}
