// The execution functions of the rules that check the Strict-Transport-
// Security header, and the STS field lines of a live response. The common
// interface is value-blind — it sees header names only — so every value
// check overrides all three contexts: `static` reads the value the API
// description pins, `test` and `analytics` read the value that was actually
// sent. Presence, a name, is the one check the common interface carries.

import {
  type ApiContext,
  constant,
  type HttpResponse,
  type LintContext,
  type LiveApiContext,
  protocol,
  responseHeader,
  type RuleFn,
  type RuleFnResult,
  type RuleViolationLocation,
} from '@thymian/core';

import {
  carriesHeader,
  describedTransaction,
  liveHeaderValues,
  pinnedHeaderValues,
} from './headers.js';
import { type RuleOptions, ruleSkip, violation } from './results.js';
import {
  parseStsFieldValue,
  STS_HEADER,
  type StsDirective,
} from './sts-field-value.js';

// Every STS field line of a live response. More than one is what
// `hsts-host-must-send-only-one-sts-header` checks; a value rule holds each
// field line to its requirement on its own.
export function liveStsValues(headers: HttpResponse['headers']): string[] {
  return liveHeaderValues(headers, STS_HEADER);
}

// Checks one STS field value; returns a violation message, or undefined.
export type StsFieldCheck = (fieldValue: string) => string | undefined;

// A directive-level rule owns one requirement and takes the generic grammar
// for granted: a field value that does not parse is left to the grammar rule,
// which reports it once — one defect, one violation — and passes here.
export function onConformingValue(
  check: (directives: StsDirective[], fieldValue: string) => string | undefined,
): StsFieldCheck {
  return (fieldValue) => {
    const parsed = parseStsFieldValue(fieldValue);
    return parsed.conforms ? check(parsed.directives, fieldValue) : undefined;
  };
}

// The execution functions of a rule that holds every STS field value to one
// check: `lint` for `.overrideStaticRule()`, `live` for `.overrideTest()` and
// `.overrideAnalyticsRule()`.
export function stsValueRuleFns(
  ruleName: string,
  check: StsFieldCheck,
): {
  lint: RuleFn<LintContext, RuleOptions>;
  live: RuleFn<LiveApiContext, RuleOptions>;
} {
  const evaluate = (
    location: RuleViolationLocation,
    fieldValues: string[],
  ): RuleFnResult[] => {
    const problems = fieldValues
      .map(check)
      .filter((problem): problem is string => problem !== undefined);

    return problems.length === 0
      ? []
      : [violation(location, problems.join(' '))];
  };

  return {
    // A function validator, not the lint context's `validateHttpTransactions`:
    // that one keeps only results carrying a violation, and an unpinned value
    // must surface as a `rule-skip` rather than vanish into a pass.
    lint: (ctx) =>
      ctx.validateCommonHttpTransactions(
        responseHeader(STS_HEADER),
        (_req, _res, location) => {
          const res = describedTransaction(ctx, location)?.thymianRes;
          const values =
            res === undefined ? undefined : pinnedHeaderValues(res, STS_HEADER);

          if (values === undefined) {
            return [
              ruleSkip(
                location,
                ruleName,
                'The API description declares Strict-Transport-Security without pinning its value (const, enum or examples), so the value cannot be checked statically.',
              ),
            ];
          }

          return evaluate(location, values);
        },
      ),
    // `constant(true)` as the candidate filter: `test` picks the requests it
    // sends by the candidate filter alone, over the *described* transactions,
    // so a response-side candidate (`responseHeader(STS_HEADER)`) would only
    // send the requests whose description already declares the header — and
    // miss a server that sends it where the description does not say so.
    live: (ctx) =>
      ctx.validateHttpTransactions(constant(true), (_req, res, location) =>
        evaluate(location, liveStsValues(res.headers)),
      ),
  };
}

// The execution function of a rule that flags a response over secure
// transport without a Strict-Transport-Security header. Presence is the one
// STS check the common interface can carry on its own: it sees the scheme
// through its request filter and header names on the response, so one
// function serves all three contexts — the declared headers in `static`, the
// headers sent in `test` and `analytics`.
export function stsPresenceRuleFn(
  message: string,
): RuleFn<ApiContext, RuleOptions> {
  return (ctx) =>
    ctx.validateCommonHttpTransactions(
      protocol('https'),
      (_req, res, location) =>
        carriesHeader(res, STS_HEADER) ? [] : [violation(location, message)],
    );
}
