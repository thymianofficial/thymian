import {
  and,
  getHeader,
  httpRule,
  method,
  requestHeader,
  type RuleViolationLocation,
} from '@thymian/core';

// "A client MAY send Max-Forwards on an OPTIONS request" is permissive: the
// header's absence is never a violation, so flagging that (as an earlier
// revision did) is a false positive on every conformant OPTIONS request. The
// one observable, conformance-checkable aspect when a client *does* exercise
// the MAY is the field's syntax — RFC 9110 §7.6.2 defines Max-Forwards =
// 1*DIGIT. So this analytics rule fires only when a Max-Forwards value is
// present but is not a non-negative decimal integer.
export default httpRule(
  'rfc9110/client-may-send-max-forwards-header-in-option-request',
)
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-options')
  .description(
    'A client MAY send a Max-Forwards header field in an OPTIONS request to target a specific recipient in the request chain.',
  )
  .explanation(
    'On an OPTIONS request a client may optionally include a Max-Forwards header, which limits how many proxies the request may pass through so a specific intermediary in the chain answers it instead of the origin. Its absence is never wrong, but when present the value must be a plain non-negative integer, since each proxy decrements it and must respond as the final recipient once it reaches zero. A malformed value breaks that hop-counting and leaves the intended recipient ambiguous.',
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      and(method('OPTIONS'), requestHeader('max-forwards')),
      (req, _res, location: RuleViolationLocation) => {
        const raw = getHeader(req.headers ?? {}, 'max-forwards');
        const value = Array.isArray(raw) ? raw.join(', ') : raw;

        // Absent (should not occur given the filter) or well-formed: no finding.
        if (value === undefined || /^\d+$/.test(value.trim())) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `A Max-Forwards header field must be a non-negative decimal integer (1*DIGIT), but this OPTIONS request carries "${value}".`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
