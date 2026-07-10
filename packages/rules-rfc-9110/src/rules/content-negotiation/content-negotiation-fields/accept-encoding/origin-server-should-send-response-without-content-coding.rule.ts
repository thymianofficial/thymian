import {
  and,
  getHeader,
  requestHeader,
  responseHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

import { createList } from '../../../../utils.js';

function headerToString(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value.join(',') : value;
}

/** Parse an Accept-Encoding field value into a coding → quality-weight map. */
function parseAcceptEncoding(value: string): Map<string, number> {
  const codings = new Map<string, number>();

  for (const part of value.split(',')) {
    const segments = part.split(';').map((segment) => segment.trim());
    const coding = segments[0]?.toLowerCase();

    if (!coding) {
      continue;
    }

    const qSegment = segments
      .slice(1)
      .find((segment) => segment.toLowerCase().startsWith('q='));

    let weight = 1;
    if (qSegment) {
      const parsed = Number(qSegment.slice(2));
      weight = Number.isNaN(parsed) ? 1 : parsed;
    }

    codings.set(coding, weight);
  }

  return codings;
}

/**
 * Determine whether an applied content coding is acceptable per the parsed
 * Accept-Encoding field, following RFC 9110 Section 12.5.3: a coding listed
 * with q=0 is unacceptable; the `identity` coding is acceptable unless
 * specifically excluded; an unlisted coding is acceptable only via a `*`
 * wildcard with non-zero weight.
 */
function isCodingAcceptable(
  coding: string,
  accept: Map<string, number>,
): boolean {
  const normalized = coding.toLowerCase();

  if (accept.has(normalized)) {
    return (accept.get(normalized) ?? 0) > 0;
  }

  const wildcard = accept.get('*');

  if (normalized === 'identity') {
    return wildcard === undefined ? true : wildcard > 0;
  }

  return wildcard === undefined ? false : wildcard > 0;
}

/** Applied content codings, excluding the no-op `identity` coding. */
function parseContentEncoding(value: string): string[] {
  return value
    .split(',')
    .map((coding) => coding.trim().toLowerCase())
    .filter((coding) => coding.length > 0 && coding !== 'identity');
}

export default httpRule(
  'rfc9110/origin-server-should-send-response-without-content-coding',
)
  .severity('warn')
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-encoding')
  .description(
    'If a non-empty Accept-Encoding header field is present in a request and none of the available representations for the response have a content coding that is listed as acceptable, the origin server SHOULD send a response without any content coding unless the identity coding is indicated as unacceptable.',
  )
  .summary(
    'The origin server SHOULD send a response without any content coding unless the identity coding is indicated as unacceptable.',
  )
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      and(requestHeader('accept-encoding'), responseHeader('content-encoding')),
      (req, res, location: RuleViolationLocation) => {
        const acceptEncoding = headerToString(
          getHeader(req.headers, 'accept-encoding'),
        );
        const contentEncoding = headerToString(
          getHeader(res.headers, 'content-encoding'),
        );

        // The filter guarantees both headers are present; an empty
        // Accept-Encoding does not constrain the server, so it is out of scope.
        if (!acceptEncoding || !acceptEncoding.trim() || !contentEncoding) {
          return [];
        }

        const accept = parseAcceptEncoding(acceptEncoding);
        const appliedCodings = parseContentEncoding(contentEncoding);

        const unacceptable = appliedCodings.filter(
          (coding) => !isCodingAcceptable(coding, accept),
        );

        if (unacceptable.length === 0) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `The response was encoded with content coding(s) ${createList(
                unacceptable,
              )} that the request's Accept-Encoding (${acceptEncoding.trim()}) does not list as acceptable. The origin server SHOULD send the response without any content coding (identity) unless identity is indicated as unacceptable.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
