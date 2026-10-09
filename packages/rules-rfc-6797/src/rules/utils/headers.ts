// How each validation context reaches a response header: as the API
// description declares it in `static`, by name only through the common
// interface, and as it was sent in `test` and `analytics`. Header names
// compare case-insensitively.

import {
  type ApiContext,
  type CommonHttpResponse,
  getHeader,
  type HttpResponse,
  type Parameter,
  type RuleViolationLocation,
  type ThymianHttpResponse,
  type ThymianHttpTransaction,
} from '@thymian/core';

// The described transaction behind a `static` or `test` location, both of
// which sit on the transaction's edge in the format.
export function describedTransaction(
  ctx: ApiContext,
  location: RuleViolationLocation,
): ThymianHttpTransaction | undefined {
  return typeof location === 'string'
    ? undefined
    : ctx.format.getThymianHttpTransactionById(location.elementId);
}

function sameHeaderName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

// A response header as the API description declares it.
function declaredHeader(
  res: ThymianHttpResponse,
  header: string,
): Parameter | undefined {
  const name = Object.keys(res.headers).find((declared) =>
    sameHeaderName(declared, header),
  );
  return name === undefined ? undefined : res.headers[name];
}

export function declaresHeader(
  res: ThymianHttpResponse,
  header: string,
): boolean {
  return declaredHeader(res, header) !== undefined;
}

// Whether a response carries a header, as the common interface sees it: by
// name only — declared in `static`, sent in `test` and `analytics`.
export function carriesHeader(
  res: CommonHttpResponse,
  header: string,
): boolean {
  return res.headers.some((name) => sameHeaderName(name, header));
}

// The values an API description pins for one response header: a `const`,
// every `enum` member, and every example. `undefined` means the header is not
// declared, or is declared without a pinned value — which is not an
// impossibility: the rule declares `static` and skips at runtime (ADR-0021 §4).
export function pinnedHeaderValues(
  res: ThymianHttpResponse,
  header: string,
): string[] | undefined {
  const schema = declaredHeader(res, header)?.schema;
  if (schema === undefined) {
    return undefined;
  }

  const values = [
    schema.const,
    ...(schema.enum ?? []),
    ...(schema.examples ?? []),
  ].filter((value): value is string => typeof value === 'string');

  return values.length > 0 ? [...new Set(values)] : undefined;
}

// Every field line of one header in a live response: repeated field lines
// arrive as an array.
export function liveHeaderValues(
  headers: HttpResponse['headers'],
  header: string,
): string[] {
  const value = getHeader(headers, header);
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}
