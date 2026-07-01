import {
  getHeader,
  requestHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

/**
 * The informational hint surfaced to the user. It both advertises the MAY
 * (a quality value may be attached to each charset) and notes that
 * Accept-Charset is deprecated by RFC 9110 (Section 12.5.2): senders should
 * omit it and rely on UTF-8 as the charset.
 */
const hintMessage =
  'A user agent MAY associate a quality value with each charset in Accept-Charset to indicate its relative preference (Section 12.4.2). Note that Accept-Charset is deprecated by RFC 9110 (Section 12.5.2); user agents should omit it and rely on UTF-8.';

function headerToString(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value.join(',') : value;
}

/** Whether any charset entry in an Accept-Charset value carries a "q" weight. */
function hasQualityValue(value: string): boolean {
  return value.split(',').some((entry) =>
    entry
      .split(';')
      .slice(1)
      .some((param) => param.trim().toLowerCase().startsWith('q=')),
  );
}

export default httpRule(
  'rfc9110/user-agent-may-associate-quality-value-with-charset',
)
  .severity('hint')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-charset')
  .description(
    "A user agent MAY associate a quality value with each charset to indicate the user's relative preference for that charset, as defined in Section 12.4.2. Note that Accept-Charset is deprecated by RFC 9110 (Section 12.5.2); user agents should omit it and rely on UTF-8.",
  )
  .summary(
    'A user agent MAY associate a quality value with each charset in Accept-Charset. Note that this header is deprecated by RFC 9110; prefer relying on UTF-8.',
  )
  .appliesTo('user-agent')
  // Static context can only observe that the request carries Accept-Charset, so
  // it always surfaces the hint (which also flags the deprecation).
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      requestHeader('accept-charset'),
      (_req, _res, location: RuleViolationLocation) => [
        { location, violation: { message: hintMessage }, findings: [] },
      ],
    ),
  )
  // Analytics has the actual header value: only surface the "you may attach a
  // quality value" hint when none of the charsets already carry one. The
  // deprecation note still applies, so the hint is emitted in that case.
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      requestHeader('accept-charset'),
      (req, _res, location: RuleViolationLocation) => {
        const acceptCharset = headerToString(
          getHeader(req.headers, 'accept-charset'),
        );

        if (!acceptCharset || hasQualityValue(acceptCharset)) {
          return [];
        }

        return [
          { location, violation: { message: hintMessage }, findings: [] },
        ];
      },
    ),
  )
  .done();
