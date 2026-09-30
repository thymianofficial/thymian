// How each validation context reaches the Strict-Transport-Security header,
// shared by every rule that checks it. The common interface is value-blind —
// it sees header names only — so every value check overrides all three
// contexts: `static` reads the value the API description pins, `test` and
// `analytics` read the value that was actually sent.

import {
  type ApiContext,
  constant,
  getHeader,
  type HttpResponse,
  type LintContext,
  type LiveApiContext,
  type Parameter,
  responseHeader,
  type RuleFn,
  type RuleFnResult,
  type RuleViolationLocation,
  type ThymianHttpResponse,
  type ThymianHttpTransaction,
} from '@thymian/core';

import {
  parseStsFieldValue,
  STS_HEADER,
  type StsDirective,
} from './sts-field-value.js';

type Options = Record<PropertyKey, unknown>;

// The described transaction behind a `static` location, which sits on the
// transaction's edge in the format.
function describedTransaction(
  ctx: ApiContext,
  location: RuleViolationLocation,
): ThymianHttpTransaction | undefined {
  return typeof location === 'string'
    ? undefined
    : ctx.format.getThymianHttpTransactionById(location.elementId);
}

// A response header as the API description declares it; header names compare
// case-insensitively.
function declaredHeader(
  res: ThymianHttpResponse,
  header: string,
): Parameter | undefined {
  const name = Object.keys(res.headers).find(
    (declared) => declared.toLowerCase() === header,
  );
  return name === undefined ? undefined : res.headers[name];
}

// The values an API description pins for one response header: a `const`,
// every `enum` member, and every example. `undefined` means the header is not
// declared, or is declared without a pinned value — which is not an
// impossibility: the rule declares `static` and skips at runtime (ADR-0021 §4).
function pinnedHeaderValues(
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

// Every STS field line of a live response. Repeated field lines arrive as an
// array; a value rule holds each field line to its requirement on its own.
function liveStsValues(headers: HttpResponse['headers']): string[] {
  const value = getHeader(headers, STS_HEADER);
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function violation(
  location: RuleViolationLocation,
  message: string,
): RuleFnResult {
  return { location, violation: { message }, findings: [] };
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
  lint: RuleFn<LintContext, Options>;
  live: RuleFn<LiveApiContext, Options>;
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
              {
                location,
                findings: [
                  {
                    kind: 'rule-skip',
                    title: ruleName,
                    message:
                      'The API description declares Strict-Transport-Security without pinning its value (const, enum or examples), so the value cannot be checked statically.',
                  },
                ],
              },
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
