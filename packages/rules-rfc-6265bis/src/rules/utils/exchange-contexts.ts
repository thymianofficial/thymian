// The execution functions of a rule that judges each cookie a response sets
// together with the request it answered — the §5.7 storage-model steps, which
// read the request host, its scheme or path, or its Fetch Metadata. Like
// `header-contexts.ts`, every context is overridden, since the common
// interface sees header names only: `static` reads the Set-Cookie values the
// description pins, `test` and `analytics` the field lines that were sent.
//
// Only a cookie a user agent keeps from its line is judged: one the user
// agent ignores in §5.6, or on receipt in §5.7, sets no cookie, and the
// grammar rule reports it.

import {
  constant,
  type HttpRequest,
  type LintContext,
  type LiveApiContext,
  responseHeader,
  type RuleFn,
  type RuleFnResult,
  type RuleViolationLocation,
} from '@thymian/core';

import {
  describedTransaction,
  liveHeaderValues,
  pinnedHeaderValues,
} from './headers.js';
import { type RuleOptions, ruleSkip, violation } from './results.js';
import {
  citeStep,
  dateOf,
  type ReceivedCookie,
  receivedCookie,
  SET_COOKIE_HEADER,
} from './set-cookie.js';
import {
  type CookieExchange,
  ignoredInStorage,
  type StorageStep,
} from './storage-model.js';
import { isServerFallbackOrigin, serverFallbackSkip } from './transport.js';

// What a check returns for a cookie whose step needs the request host or
// scheme where the transport is not judged: the rule skips the response,
// rather than pass it, unless another of its cookies is a violation.
export const TRANSPORT_NOT_JUDGED = Symbol('transport not judged');

// Checks one cookie; returns a violation message, `TRANSPORT_NOT_JUDGED`, or
// undefined.
export type CookieExchangeCheck = (
  cookie: ReceivedCookie,
  exchange: CookieExchange,
) => string | typeof TRANSPORT_NOT_JUDGED | undefined;

// `lint` is for `.overrideStaticRule()`, `test` for `.overrideTest()` and
// `analytics` for `.overrideAnalyticsRule()`. `static` and `test` carry the
// described origin, so both leave the server URL fallback unjudged; recorded
// traffic in `analytics` is real, so it judges every origin.
export function cookieExchangeRuleFns(
  ruleName: string,
  check: CookieExchangeCheck,
): {
  lint: RuleFn<LintContext, RuleOptions>;
  test: RuleFn<LiveApiContext, RuleOptions>;
  analytics: RuleFn<LiveApiContext, RuleOptions>;
} {
  // The problems of one response make one violation.
  const evaluate = (
    location: RuleViolationLocation,
    lines: string[],
    exchange: CookieExchange,
  ): RuleFnResult[] => {
    const verdicts = lines.map((line) => {
      const cookie = receivedCookie(line);
      return cookie === undefined ? undefined : check(cookie, exchange);
    });
    const problems = verdicts.filter(
      (verdict): verdict is string => typeof verdict === 'string',
    );

    if (problems.length > 0) {
      return [violation(location, problems.join(' '))];
    }
    return verdicts.includes(TRANSPORT_NOT_JUDGED)
      ? [serverFallbackSkip(location, ruleName)]
      : [];
  };

  const live =
    ({ skipServerFallback }: { skipServerFallback: boolean }) =>
    (ctx: LiveApiContext) =>
      // `constant(true)` as the candidate filter, as in `header-contexts.ts`:
      // a response-side candidate would never send the requests whose
      // description declares no Set-Cookie.
      ctx.validateHttpTransactions(
        constant(true),
        (req: HttpRequest, res, location) =>
          evaluate(location, liveHeaderValues(res.headers, SET_COOKIE_HEADER), {
            origin: req.origin,
            path: req.path,
            headers: req.headers ?? {},
            transportJudged: !(
              skipServerFallback && isServerFallbackOrigin(req.origin)
            ),
            responseDate: dateOf(liveHeaderValues(res.headers, 'Date')),
          }),
      );

  return {
    // A function validator, so an unpinned value surfaces as a `rule-skip`.
    lint: (ctx) =>
      ctx.validateCommonHttpTransactions(
        responseHeader(SET_COOKIE_HEADER),
        (req, _res, location) => {
          const res = describedTransaction(ctx, location)?.thymianRes;
          const lines =
            res === undefined
              ? undefined
              : pinnedHeaderValues(res, SET_COOKIE_HEADER);

          if (res === undefined || lines === undefined) {
            return [
              ruleSkip(
                location,
                ruleName,
                `The API description declares ${SET_COOKIE_HEADER} without pinning its value (const, enum or examples), so the cookie it sets cannot be checked statically.`,
              ),
            ];
          }

          return evaluate(location, lines, {
            origin: req.origin,
            path: req.path,
            headers: {},
            transportJudged: !isServerFallbackOrigin(req.origin),
            responseDate: dateOf(pinnedHeaderValues(res, 'Date')),
          });
        },
      ),
    test: live({ skipServerFallback: true }),
    analytics: live({ skipServerFallback: false }),
  };
}

// The check of a rule on one exact §5.7 step: a violation where that step is
// the first that ignores the cookie, with what the server should do instead.
export function ignoredAtStep(
  step: StorageStep,
  advice: string,
): CookieExchangeCheck {
  return (cookie, exchange) => {
    const ignored = ignoredInStorage(cookie, exchange);
    return ignored?.step === step
      ? `A user agent ignores the cookie "${cookie.name}" entirely (${citeStep(step)}): ${ignored.reason}. ${advice}`
      : undefined;
  };
}
