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
  protocol,
  responseHeader,
  type RuleFn,
  type RuleFnResult,
  type RuleViolationLocation,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
  type ThymianHttpTransaction,
} from '@thymian/core';

import {
  parseStsFieldValue,
  STS_HEADER,
  type StsDirective,
} from './sts-field-value.js';

type Options = Record<PropertyKey, unknown>;

// A document with no `servers`, a relative server URL, or a variable in the
// scheme or port that cannot be resolved is loaded as
// `http://localhost:8080` (thymianofficial/thymian-workspace#81): the scheme
// is Thymian's fallback, not the API's. Rules asserting on the scheme skip
// exactly that fallback rather than report a transport the description never
// declared. A document that really declares `http://localhost:8080` is a
// local development server, where HSTS does not apply in practice.
export function isFabricatedServerFallback(req: ThymianHttpRequest): boolean {
  return (
    req.protocol === 'http' && req.host === 'localhost' && req.port === 8080
  );
}

// The described transaction behind a location from `static` or `test`, which
// both locate a result on the transaction's edge in the format.
export function describedTransaction(
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

export function declaresStsHeader(res: ThymianHttpResponse): boolean {
  return declaredHeader(res, STS_HEADER) !== undefined;
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

// Every STS field line of a live response. Repeated field lines arrive as an
// array, which is what `hsts-host-must-send-only-one-sts-header` checks; every
// other rule holds each field line to its requirement on its own.
export function liveStsValues(headers: HttpResponse['headers']): string[] {
  const value = getHeader(headers, STS_HEADER);
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function violation(
  location: RuleViolationLocation,
  message: string,
): RuleFnResult {
  return { location, violation: { message }, findings: [] };
}

// Checks one STS field value; returns a violation message, or undefined.
export type StsFieldCheck = (fieldValue: string) => string | undefined;

// Most value rules own one directive-level requirement and take the generic
// grammar for granted: a field value that does not parse is reported once, by
// `hsts-host-must-send-sts-header-conforming-to-grammar`, and skipped here.
export function onConformingValue(
  check: (directives: StsDirective[], fieldValue: string) => string | undefined,
): StsFieldCheck {
  return (fieldValue) => {
    const parsed = parseStsFieldValue(fieldValue);
    return parsed.conforms ? check(parsed.directives, fieldValue) : undefined;
  };
}

// The two execution functions of a rule that holds every STS field value to
// one check: `lint` for `.overrideStaticRule()`, `live` for `.overrideTest()`
// and `.overrideAnalyticsRule()`.
export function stsValueRule(
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

// The two execution functions of a rule that flags a response over secure
// transport without a Strict-Transport-Security header.
export function stsPresenceRule(message: string): {
  lint: RuleFn<LintContext, Options>;
  live: RuleFn<LiveApiContext, Options>;
} {
  return {
    lint: (ctx) =>
      ctx.validateHttpTransactions(
        (req, res) => req.protocol === 'https' && !declaresStsHeader(res),
        () => ({ violation: { message }, findings: [] }),
      ),
    live: (ctx) =>
      ctx.validateHttpTransactions(protocol('https'), (_req, res, location) =>
        liveStsValues(res.headers).length === 0
          ? [violation(location, message)]
          : [],
      ),
  };
}
