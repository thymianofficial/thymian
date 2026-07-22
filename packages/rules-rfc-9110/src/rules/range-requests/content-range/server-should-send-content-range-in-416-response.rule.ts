import {
  and,
  getHeader,
  type HttpResponse,
  requestHeader,
  type RuleViolationLocation,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

// The 416 unsatisfied-range form is "bytes */complete-length" (or "bytes */*"
// when the length is unknown). Presence of the Content-Range NAME alone is not
// enough — the clause requires this specific value shape, which the common
// projection cannot see. Match case-insensitively.
const UNSATISFIED_RANGE = /^bytes\s+\*\/(\d+|\*)$/i;

function evaluate(res: HttpResponse, location: RuleViolationLocation) {
  const contentRange = getHeader(res.headers, 'content-range');
  const values = Array.isArray(contentRange)
    ? contentRange
    : contentRange != null
      ? [contentRange]
      : [];

  if (values.length === 0) {
    return [
      {
        location,
        violation: {
          message:
            'A 416 (Range Not Satisfiable) response to a Range request omits Content-Range. The server SHOULD send an unsatisfied-range value ("bytes */complete-length").',
        },
        findings: [],
      },
    ];
  }

  if (values.every((value) => UNSATISFIED_RANGE.test(value.trim()))) {
    return [];
  }

  return [
    {
      location,
      violation: {
        message: `A 416 response carries a Content-Range ("${values
          .map((value) => value.trim())
          .join(
            ', ',
          )}") that is not the unsatisfied-range form ("bytes */complete-length").`,
      },
      findings: [],
    },
  ];
}

export default httpRule(
  'rfc9110/server-should-send-content-range-in-416-response',
)
  .severity('warn')
  // A response-side, server-behavior check. The 416 Content-Range value must
  // carry the unsatisfied-range form (bytes */len), so the common projection
  // (header names only) is insufficient.
  .type('analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-content-range')
  .description(
    'A server generating a 416 (Range Not Satisfiable) response to a byte-range request SHOULD send a Content-Range header field with an unsatisfied-range value. The complete-length in a 416 response indicates the current length of the selected representation.',
  )
  .summary(
    'Server should send Content-Range with unsatisfied-range in 416 responses.',
  )
  .appliesTo('server')
  .overrideTest((ctx) =>
    ctx.validateHttpTransactions(
      and(statusCode(416), requestHeader('range')),
      (_req, res, location) => evaluate(res, location),
    ),
  )
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(statusCode(416), requestHeader('range')),
      (_req, res, location) => evaluate(res, location),
    ),
  )
  .done();
