// RFC 6797 §7.2: a request over non-secure transport SHOULD be answered with
// "a status code indicating a permanent redirect, such as status code 301",
// and a Location whose URI scheme is https. Shared by the RFC's own rule and
// the convention rule that asks the same of every server.

import {
  getHeader,
  type HttpRequest,
  type HttpResponse,
  type LintContext,
  type LiveApiContext,
  protocol,
  type RuleFn,
  type RuleFnResult,
  singleTestCase,
  type TestContext,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';

import {
  isFabricatedServerFallback,
  pinnedHeaderValues,
  violation,
} from './sts-contexts.js';

type Options = Record<PropertyKey, unknown>;

// 301 (Moved Permanently) and 308 (Permanent Redirect) are HTTP's two
// permanent redirects; 302, 303 and 307 are temporary, which would leave the
// user agent retrying plain HTTP every time.
export const PERMANENT_REDIRECTS: readonly number[] = [301, 308];

// Resolves a Location reference against the URI it was received for; a
// relative reference keeps the request's own scheme.
function locationScheme(location: string, base: string): string | undefined {
  try {
    return new URL(location, base).protocol.replace(/:$/, '');
  } catch {
    return undefined;
  }
}

// Why a response to a plain-HTTP request is not the redirect §7.2 asks for,
// or undefined when it is.
function redirectProblem(
  request: HttpRequest,
  response: HttpResponse,
): string | undefined {
  const status = response.statusCode;
  if (!PERMANENT_REDIRECTS.includes(status)) {
    return `This request over non-secure transport (http) was answered with ${status}, not a permanent redirect. It should be answered with a permanent redirect (such as 301) to the resource over https.`;
  }

  const header = getHeader(response.headers, 'location');
  const location = Array.isArray(header) ? header[0] : header;
  if (location === undefined || location.trim() === '') {
    return `This request over non-secure transport (http) was answered with ${status} but no Location. It should be redirected to the resource over https.`;
  }

  const scheme = locationScheme(
    location,
    new URL(request.path, request.origin).toString(),
  );
  return scheme === 'https'
    ? undefined
    : `This request over non-secure transport (http) is redirected to "${location}", which is not an https URI. It should be redirected to the resource over https.`;
}

// Static: an operation the description serves over http should declare a
// permanent redirect, and a Location it pins should be https. Judged once per
// operation, over all of its declared responses.
function staticRedirectProblem(
  req: ThymianHttpRequest,
  responses: ThymianHttpResponse[],
): string | undefined {
  const redirects = responses.filter((res) =>
    PERMANENT_REDIRECTS.includes(res.statusCode),
  );
  if (redirects.length === 0) {
    return 'This operation is served over non-secure transport (http) and declares no permanent redirect (301 or 308). A request over non-secure transport should be answered with a permanent redirect to the resource over https.';
  }

  const base = `${req.protocol}://${req.host}:${req.port}${req.path}`;
  const insecure = redirects
    .flatMap((res) => pinnedHeaderValues(res, 'location') ?? [])
    .filter((location) => locationScheme(location, base) !== 'https');

  return insecure.length === 0
    ? undefined
    : `This operation is served over non-secure transport (http) and redirects to ${insecure.map((location) => `"${location}"`).join(', ')}, which is not an https URI. It should redirect to the resource over https.`;
}

// The three execution functions of a rule that holds plain-HTTP requests to
// §7.2's redirect. The server URL fallback
// (thymianofficial/thymian-workspace#81, see `sts-contexts.ts`) is skipped in
// `static` and in `test`, whose requests carry the described origin.
export function redirectRule(): {
  lint: RuleFn<LintContext, Options>;
  test: RuleFn<TestContext, Options>;
  analytics: RuleFn<LiveApiContext, Options>;
} {
  return {
    lint: (ctx) =>
      ctx.validateHttpTransactions(
        (req, res, responses) =>
          req.protocol === 'http' &&
          !isFabricatedServerFallback(req) &&
          res === responses[0],
        (req, _res, responses) => {
          const problem = staticRedirectProblem(req, responses);
          return problem === undefined
            ? false
            : { violation: { message: problem }, findings: [] };
        },
      ),
    // The redirect is a different status than the description declares for
    // the operation, so the step opts out of the status-code check that would
    // otherwise skip exactly the responses this rule exists to judge. One
    // verdict per request, however many responses it declares.
    test: async (ctx) => {
      const results: RuleFnResult[] = [];
      const judged = new Set<string>();

      await ctx.httpTest(
        singleTestCase()
          .forTransactionsWith(protocol('http'))
          .run({ checkStatusCode: false })
          .transactions(([{ source, request, response }]) => {
            if (
              isFabricatedServerFallback(source.thymianReq) ||
              judged.has(source.thymianReqId)
            ) {
              return;
            }
            judged.add(source.thymianReqId);

            const problem = redirectProblem(request, response);
            if (problem !== undefined) {
              results.push(
                violation(
                  { elementType: 'edge', elementId: source.transactionId },
                  problem,
                ),
              );
            }
          })
          .done(),
      );

      return results;
    },
    analytics: (ctx) =>
      ctx.validateHttpTransactions(protocol('http'), (req, res, location) => {
        const problem = redirectProblem(req, res);
        return problem === undefined ? [] : [violation(location, problem)];
      }),
  };
}
