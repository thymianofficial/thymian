// How each validation context reaches the Strict-Transport-Security header
// and the transport it travelled over, shared by every rule that checks
// either. The common interface is value-blind — it sees header names only —
// so every value check overrides all three contexts: `static` reads the value
// the API description pins, `test` and `analytics` read the value that was
// actually sent.

import {
  type ApiContext,
  type CommonHttpResponse,
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
  type ThymianHttpResponse,
  type ThymianHttpTransaction,
} from '@thymian/core';

import {
  parseStsFieldValue,
  STS_HEADER,
  type StsDirective,
} from './sts-field-value.js';

type Options = Record<PropertyKey, unknown>;

// A document with no `servers` entry, a relative server URL, or a variable
// in the scheme or port that cannot be resolved is loaded as
// `http://localhost:8080`: the scheme is Thymian's fallback, not the API's.
// A rule judging the scheme skips exactly that origin in `static` and in
// `test`, whose requests carry the described origin even when sent to a
// target URL, rather than report a transport the description never declared.
// A description that really declares `http://localhost:8080` is a local
// development server, where HSTS is not demanded in practice either.
// `analytics` never skips it: recorded traffic is real.
const SERVER_FALLBACK_ORIGIN = 'http://localhost:8080';

export function isServerFallbackOrigin(origin: string): boolean {
  try {
    return new URL(origin).origin === SERVER_FALLBACK_ORIGIN;
  } catch {
    return false;
  }
}

// The described transaction behind a `static` or `test` location, both of
// which sit on the transaction's edge in the format.
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

export function declaresHeader(
  res: ThymianHttpResponse,
  header: string,
): boolean {
  return declaredHeader(res, header) !== undefined;
}

// Whether a response carries a header, as the common interface sees it: by
// name only — declared in `static`, sent in `test` and `analytics`.
export function carriesHeader(
  res: CommonHttpResponse,
  header: string,
): boolean {
  return res.headers.some((name) => name.toLowerCase() === header);
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
// array, which is what `hsts-host-must-send-only-one-sts-header` checks; a
// value rule holds each field line to its requirement on its own.
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

// A result that says the rule could not decide this input, rather than pass
// it: a finding with no violation, which the reports render as skipped.
export function ruleSkip(
  location: RuleViolationLocation,
  ruleName: string,
  message: string,
): RuleFnResult {
  return {
    location,
    findings: [{ kind: 'rule-skip', title: ruleName, message }],
  };
}

export function serverFallbackSkip(
  location: RuleViolationLocation,
  ruleName: string,
): RuleFnResult {
  return ruleSkip(
    location,
    ruleName,
    `This request is served from ${SERVER_FALLBACK_ORIGIN}, which is also what Thymian loads an API description without a usable server URL as, so its scheme may be Thymian's rather than the API's and the transport is not judged.`,
  );
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
): RuleFn<ApiContext, Options> {
  return (ctx) =>
    ctx.validateCommonHttpTransactions(
      protocol('https'),
      (_req, res, location) =>
        carriesHeader(res, STS_HEADER) ? [] : [violation(location, message)],
    );
}
