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
    path: parsed.pathname,
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

  let origin: string;
  let path: string;

  try {
    const parsed = parseUrl(entry.request.url);
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

export function transformHar(
  har: HarLog,
  clientRole: HttpParticipantRole,
  serverRole: HttpParticipantRole,
): {
  transactions: CapturedTransaction[];
  skippedCount: number;
} {
  const transactions: CapturedTransaction[] = [];
  let skippedCount = 0;

  for (const entry of har.log.entries) {
    const transaction = transformHarEntry(entry, clientRole, serverRole);
    if (transaction) {
      transactions.push(transaction);
    } else {
      skippedCount++;
    }
  }

  return { transactions, skippedCount };
}
