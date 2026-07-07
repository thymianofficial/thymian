import {
  getHeader,
  requestHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

/**
 * Accept-Charset is deprecated by RFC 9110 (Section 12.5.2). This note applies
 * whenever the header is present — independent of whether a quality value is
 * used — so it is always surfaced.
 */
const deprecationNote =
  'Note that Accept-Charset is deprecated by RFC 9110 (Section 12.5.2); user agents should omit it and rely on UTF-8.';

/**
 * The permissive MAY: a quality value may be attached to each charset to
 * indicate relative preference (Section 12.4.2). Only worth surfacing when the
 * sender is not already using a quality value.
 */
const qualityValueHint =
  'A user agent MAY associate a quality value with each charset in Accept-Charset to indicate its relative preference (Section 12.4.2).';

/** The full hint: the permissive MAY followed by the deprecation note. */
const fullHint = `${qualityValueHint} ${deprecationNote}`;

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
  // it always surfaces the full hint (the MAY plus the deprecation note).
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      requestHeader('accept-charset'),
      (_req, _res, location: RuleViolationLocation) => [
        { location, violation: { message: fullHint }, findings: [] },
      ],
    ),
  )
  // Analytics has the actual header value. The deprecation note is always
  // surfaced while Accept-Charset is present; the "you may attach a quality
  // value" hint is added only when none of the charsets already carry one.
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      requestHeader('accept-charset'),
      (req, _res, location: RuleViolationLocation) => {
        const acceptCharset = headerToString(
          getHeader(req.headers, 'accept-charset'),
        );

        if (!acceptCharset) {
          return [];
        }

        const message = hasQualityValue(acceptCharset)
          ? deprecationNote
          : fullHint;

        return [{ location, violation: { message }, findings: [] }];
      },
    ),
  )
  .done();
