// RFC 6797 §7.2: a request over non-secure transport SHOULD be answered with
// "a status code indicating a permanent redirect, such as status code 301",
// and a Location whose URI scheme is https. Shared by the RFC's own rule and
// the convention rule that asks the same of every server, so the two cannot
// disagree on what a redirect is.

import {
  getHeader,
  type HttpRequest,
  type HttpResponse,
  type LintContext,
  type LiveApiContext,
  protocol,
  type RuleFn,
  type RuleFnResult,
  type RuleViolationLocation,
  singleTestCase,
  type TestContext,
  type ThymianHttpResponse,
} from '@thymian/core';

import {
  declaresHeader,
  describedTransaction,
  isServerFallbackOrigin,
  pinnedHeaderValues,
  ruleSkip,
  serverFallbackSkip,
  violation,
} from './sts-contexts.js';

type Options = Record<PropertyKey, unknown>;

// 301 (Moved Permanently) and 308 (Permanent Redirect) are HTTP's two
// permanent redirects. 302, 303 and 307 redirect too, but not permanently:
// the user agent comes back over plain HTTP every time.
const PERMANENT_REDIRECTS: readonly number[] = [301, 308];
const OTHER_REDIRECTS: readonly number[] = [302, 303, 307];

const SHOULD_REDIRECT =
  'A request over non-secure transport should be answered with a permanent redirect (301 or 308) to the resource over https.';

// The URI a request was made for, which a relative Location resolves
// against: the same shape whether declared, sent or recorded.
function requestUri({ origin, path }: { origin: string; path: string }) {
  return new URL(path, origin).toString();
}

// The scheme a Location reference names once resolved against the URI it
// was received for: a relative reference takes the request's own scheme.
function locationScheme(location: string, base: string): string | undefined {
  try {
    return new URL(location, base).protocol.replace(/:$/, '');
  } catch {
    return undefined;
  }
}

// How a message names the response it judges: as the API description
// declares it in `static`, as the server answered in `test` and `analytics`.
type Wording = { answered: string; redirected: string };

const DECLARED: Wording = {
  answered:
    'This operation is served over non-secure transport (http) and declares a',
  redirected:
    'This operation is served over non-secure transport (http) and redirects to',
};

const ANSWERED: Wording = {
  answered: 'This request over non-secure transport (http) was answered with',
  redirected: 'This request over non-secure transport (http) is redirected to',
};

// Why one response to a plain-http request is not the redirect §7.2 asks
// for, or undefined when it is. `locations` are the Location values: the
// ones the description pins in `static`, the ones sent in `test` and
// `analytics`. Every one of them must name an https URI.
function redirectProblem(
  wording: Wording,
  status: number,
  locations: string[],
  base: string,
): string | undefined {
  if (!PERMANENT_REDIRECTS.includes(status)) {
    return OTHER_REDIRECTS.includes(status)
      ? `${wording.answered} ${status}, a redirect that is not permanent, which the user agent follows again over plain http on every visit. ${SHOULD_REDIRECT}`
      : `${wording.answered} ${status}, not a redirect. ${SHOULD_REDIRECT}`;
  }

  const targets = locations.filter((location) => location.trim() !== '');
  if (targets.length === 0) {
    return `${wording.answered} ${status} without a Location header field, so the redirect names no target. ${SHOULD_REDIRECT}`;
  }

  const insecure = targets.filter(
    (target) => locationScheme(target, base) !== 'https',
  );
  return insecure.length === 0
    ? undefined
    : `${wording.redirected} ${insecure.map((target) => `"${target}"`).join(', ')}, which is not an https URI. ${SHOULD_REDIRECT}`;
}

function liveRedirectProblem(
  request: HttpRequest,
  response: HttpResponse,
): string | undefined {
  const header = getHeader(response.headers, 'location');
  const location = Array.isArray(header) ? header[0] : header;

  return redirectProblem(
    ANSWERED,
    response.statusCode,
    location === undefined ? [] : [location],
    requestUri(request),
  );
}

type StaticVerdict =
  | { kind: 'passes' }
  | { kind: 'violates'; message: string }
  | { kind: 'undecidable'; message: string };

// Static: each response the description declares for an operation served
// over http is held to the redirect on its own, as each answer is live —
// a permanent redirect beside it does not excuse a 200 or a 302. A Location
// declared without a pinned value cannot be checked, which is a
// `rule-skip`, never a pass.
function staticRedirectVerdict(
  base: string,
  res: ThymianHttpResponse,
): StaticVerdict {
  const locations = pinnedHeaderValues(res, 'location');
  if (
    locations === undefined &&
    PERMANENT_REDIRECTS.includes(res.statusCode) &&
    declaresHeader(res, 'location')
  ) {
    return {
      kind: 'undecidable',
      message:
        'The API description declares the redirect with a Location header field but does not pin its value (const, enum or examples), so its scheme cannot be checked statically.',
    };
  }

  const problem = redirectProblem(
    DECLARED,
    res.statusCode,
    locations ?? [],
    base,
  );
  return problem === undefined
    ? { kind: 'passes' }
    : { kind: 'violates', message: problem };
}

// The three execution functions of a rule that holds plain-http requests to
// §7.2's redirect. The server URL fallback (see `isServerFallbackOrigin`) is
// skipped in `static` and in `test`, and judged in `analytics`.
export function redirectRuleFns(ruleName: string): {
  lint: RuleFn<LintContext, Options>;
  test: RuleFn<TestContext, Options>;
  analytics: RuleFn<LiveApiContext, Options>;
} {
  return {
    // A function validator, because the lint context's
    // `validateHttpTransactions` keeps only results carrying a violation and
    // a skip must surface. One verdict per declared response.
    lint: (ctx) =>
      ctx.validateCommonHttpTransactions(
        protocol('http'),
        (req, _res, location) => {
          const res = describedTransaction(ctx, location)?.thymianRes;
          if (res === undefined) {
            return [];
          }

          if (isServerFallbackOrigin(req.origin)) {
            return [serverFallbackSkip(location, ruleName)];
          }

          const verdict = staticRedirectVerdict(requestUri(req), res);
          switch (verdict.kind) {
            case 'violates':
              return [violation(location, verdict.message)];
            case 'undecidable':
              return [ruleSkip(location, ruleName, verdict.message)];
            case 'passes':
              return [];
          }
        },
      ),

    // The redirect is a status the description does not declare for the
    // operation, so the step opts out of the status-code check, which would
    // otherwise skip exactly the responses this rule exists to judge. A
    // request is sent once per declared response; it gets one verdict.
    test: async (ctx) => {
      const results: RuleFnResult[] = [];
      const judged = new Set<string>();

      await ctx.httpTest(
        singleTestCase()
          .forTransactionsWith(protocol('http'))
          .run({ checkStatusCode: false })
          .transactions(([{ source, request, response }]) => {
            if (judged.has(source.thymianReqId)) {
              return;
            }
            judged.add(source.thymianReqId);

            const location: RuleViolationLocation = {
              elementType: 'edge',
              elementId: source.transactionId,
            };
            if (isServerFallbackOrigin(request.origin)) {
              results.push(serverFallbackSkip(location, ruleName));
              return;
            }

            const problem = liveRedirectProblem(request, response);
            if (problem !== undefined) {
              results.push(violation(location, problem));
            }
          })
          .done(),
      );

      return results;
    },

    analytics: (ctx) =>
      ctx.validateHttpTransactions(protocol('http'), (req, res, location) => {
        const problem = liveRedirectProblem(req, res);
        return problem === undefined ? [] : [violation(location, problem)];
      }),
  };
}
