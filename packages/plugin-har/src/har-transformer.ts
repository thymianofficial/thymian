import type { CapturedTransaction, HttpParticipantRole } from '@thymian/core';

import type { HarEntry, HarHeader, HarLog } from './har-types.js';

export function transformHarHeaders(
  headers: HarHeader[],
): Record<string, string | string[] | undefined> {
  const result: Record<string, string | string[] | undefined> = {};

  for (const header of headers) {
    const key = header.name.toLowerCase();
    const existing = result[key];

    if (existing === undefined) {
      result[key] = header.value;
    } else if (Array.isArray(existing)) {
      existing.push(header.value);
    } else {
      result[key] = [existing, header.value];
    }
  }

  return result;
}

export function parseUrl(url: string): { origin: string; path: string } {
  const parsed = new URL(url);
  return {
    origin: parsed.origin,
    path: parsed.pathname + parsed.search,
  };
}

export function transformHarEntry(
  entry: HarEntry,
  clientRole: HttpParticipantRole,
  serverRole: HttpParticipantRole,
): CapturedTransaction | null {
  if (!entry.response) {
    return null;
  }

  // Read outside the try so a missing request throws to the caller
  // instead of being mistaken for an invalid URL.
  const url = entry.request.url;
  let origin: string;
  let path: string;

  try {
    const parsed = parseUrl(url);
    origin = parsed.origin;
    path = parsed.path;
  } catch {
    return null;
  }

  return {
    request: {
      data: {
        method: entry.request.method.toLowerCase(),
        origin,
        path,
        target: entry.request.url,
        headers: transformHarHeaders(entry.request.headers),
        body: entry.request.postData?.text,
      },
      meta: { role: clientRole },
    },
    response: {
      data: {
        statusCode: entry.response.status,
        headers: transformHarHeaders(entry.response.headers),
        body: entry.response.content.text,
        bodyEncoding: entry.response.content.encoding,
        trailers: {},
        duration: entry.time,
      },
      meta: { role: serverRole },
    },
  };
}

/**
 * A request or response message whose `headers` is not an array: absent,
 * `null` or any other shape. A missing request object is not a headers
 * problem and is left to the `malformed entry` path.
 */
function lacksHeaders(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    !Array.isArray((message as { headers?: unknown }).headers)
  );
}

export function transformHar(
  har: HarLog,
  clientRole: HttpParticipantRole,
  serverRole: HttpParticipantRole,
): {
  transactions: CapturedTransaction[];
  skippedCount: number;
  skippedReasons: string[];
} {
  const transactions: CapturedTransaction[] = [];
  const skippedReasons: string[] = [];

  for (const entry of har.log.entries) {
    if (!entry.response) {
      skippedReasons.push('missing response');
      continue;
    }

    if (lacksHeaders(entry.request)) {
      skippedReasons.push('missing request headers');
      continue;
    }

    if (lacksHeaders(entry.response)) {
      skippedReasons.push('missing response headers');
      continue;
    }

    let transaction: CapturedTransaction | null;
    try {
      transaction = transformHarEntry(entry, clientRole, serverRole);
    } catch {
      skippedReasons.push('malformed entry');
      continue;
    }

    // The response is present (checked above), so null means the request
    // URL failed to parse.
    if (transaction) {
      transactions.push(transaction);
    } else {
      skippedReasons.push('invalid request URL');
    }
  }

  return {
    transactions,
    skippedCount: skippedReasons.length,
    skippedReasons,
  };
}
