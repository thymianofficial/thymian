// The execution functions of a rule that holds every field value of one
// response header to one check. The common interface is value-blind — it
// sees header names only — so every value check overrides all three
// contexts: `static` reads the values the API description pins, `test` and
// `analytics` read the field lines that were actually sent.

import {
  constant,
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

// Checks one field value; returns a violation message, or undefined.
export type FieldValueCheck = (fieldValue: string) => string | undefined;

// `header` is the field name as a message spells it, such as "Set-Cookie";
// names compare case-insensitively. Each field value is checked on its own:
// a repeated header arrives as one value per field line, and nothing here
// splits a value on commas. The problems of one response make one violation.
//
// `lint` is for `.overrideStaticRule()`, `live` for `.overrideTest()` and
// `.overrideAnalyticsRule()`.
export function headerValueRuleFns(
  header: string,
  ruleName: string,
  check: FieldValueCheck,
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
        responseHeader(header),
        (_req, _res, location) => {
          const res = describedTransaction(ctx, location)?.thymianRes;
          const values =
            res === undefined ? undefined : pinnedHeaderValues(res, header);

          if (values === undefined) {
            return [
              ruleSkip(
                location,
                ruleName,
                `The API description declares ${header} without pinning its value (const, enum or examples), so the value cannot be checked statically.`,
              ),
            ];
          }

          return evaluate(location, values);
        },
      ),
    // `constant(true)` as the candidate filter: `test` picks the requests it
    // sends by the candidate filter alone, over the *described* transactions,
    // so a response-side candidate (`responseHeader(header)`) would only send
    // the requests whose description already declares the header — and miss
    // a server that sends it where the description does not say so.
    live: (ctx) =>
      ctx.validateHttpTransactions(constant(true), (_req, res, location) =>
        evaluate(location, liveHeaderValues(res.headers, header)),
      ),
  };
}
