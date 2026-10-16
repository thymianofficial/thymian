// Fixture inputs, one builder per thing a fixture needs to say: where a
// request is served from, an API description and the headers it declares,
// what the server answers in `test`, and a recorded transaction for
// `analytics` — so a fixture module is its data and nothing else. A family
// of rules that shares one fixture shape gets one builder for the whole set.

import {
  type CapturedTransaction,
  type HttpRequest,
  type HttpResponse,
  type Parameter,
  type Rule,
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createParameter,
  createStringSchema,
} from '@thymian/core-testing';

import { SET_COOKIE_HEADER } from '../rules/utils/set-cookie.js';
import type { CaseOf, RuleFixtures } from './harness.js';

type Origin = Pick<ThymianHttpRequest, 'protocol' | 'host' | 'port'>;

export const SECURE = {
  protocol: 'https',
  host: 'api.example.com',
  port: 443,
} as const satisfies Origin;

export const INSECURE = {
  protocol: 'http',
  host: 'api.example.com',
  port: 80,
} as const satisfies Origin;

// What a document with no usable `servers` entry loads as: the scheme is
// Thymian's fallback, not the API's.
export const FALLBACK = {
  protocol: 'http',
  host: 'localhost',
  port: 8080,
} as const satisfies Origin;

// An origin as recorded traffic carries it, e.g. "https://api.example.com".
function originOf({ protocol, host, port }: Origin): string {
  return new URL(`${protocol}://${host}:${port}`).origin;
}

// A declared header. One value pins it as the schema's `const`, several as
// its `examples`, each one a value the response may carry; without one the
// header is declared but unpinned.
export function header(
  name: string,
  ...values: string[]
): Record<string, Parameter> {
  const [only] = values;
  return {
    [name]: createParameter({
      required: true,
      schema:
        values.length === 0
          ? createStringSchema()
          : values.length === 1
            ? createStringSchema({ const: only })
            : createStringSchema({ examples: values }),
    }),
  };
}

// A declared Set-Cookie, pinned to the lines given, or unpinned without one.
// An API description's header map holds one Set-Cookie declaration, so
// several lines are several pinned values of it.
export function setCookieHeader(...lines: string[]): Record<string, Parameter> {
  return header(SET_COOKIE_HEADER, ...lines);
}

type DescribedTransaction = {
  request?: Partial<ThymianHttpRequest>;
  response?: Partial<ThymianHttpResponse>;
};

// An API description; every request is served from `SECURE` unless it says
// otherwise.
export function apiDescription(
  ...transactions: DescribedTransaction[]
): ThymianFormat {
  const format = new ThymianFormat();
  for (const { request, response } of transactions) {
    format.addHttpTransaction(
      createHttpRequest({ ...SECURE, ...request }),
      createHttpResponse(response),
      'fixture',
    );
  }
  return format;
}

type Answer = { statusCode?: number; headers?: HttpResponse['headers'] };

// The server under test in `test`: answers every request alike.
export function respondWith({
  statusCode = 200,
  headers = {},
}: Answer): () => HttpResponse {
  return () => ({ statusCode, headers, trailers: {}, duration: 1 });
}

// The server under test in `test`, answering a request over https one way
// and a request over plain http another — so one conforming input shows a
// transport rule judging the scheme and the response together.
export function respondByScheme(answers: {
  https: Answer;
  http: Answer;
}): (request: HttpRequest) => HttpResponse {
  return (request) =>
    respondWith(
      new URL(request.origin).protocol === 'https:'
        ? answers.https
        : answers.http,
    )();
}

// One recorded transaction, as an origin server answered a user agent.
// `headers` are the response's; `requestHeaders` what the user agent sent,
// such as its Fetch Metadata.
export function recorded({
  origin = SECURE,
  path = '/',
  statusCode = 200,
  headers = {},
  requestHeaders = {},
}: {
  origin?: Origin;
  path?: string;
  statusCode?: number;
  headers?: HttpResponse['headers'];
  requestHeaders?: NonNullable<HttpRequest['headers']>;
}): CapturedTransaction {
  return {
    request: {
      data: {
        origin: originOf(origin),
        path,
        method: 'get',
        headers: requestHeaders,
      },
      meta: { role: 'user-agent' },
    },
    response: {
      data: { statusCode, headers, trailers: {}, duration: 1 },
      meta: { role: 'origin server' },
    },
  };
}

// The Set-Cookie field lines of one live response: one line is a string,
// several arrive as an array, one entry per field line, as core delivers a
// repeated Set-Cookie without ever splitting it on commas.
export function setCookieLines(lines: string[]): HttpResponse['headers'] {
  return { [SET_COOKIE_HEADER]: lines.length === 1 ? lines[0] : lines };
}

// Set-Cookie lines in every context, all on one response to a request served
// from `origin`: pinned by an API description, answered by a server under
// test, and recorded. In `test` the description declares no header at all:
// the server sending one anyway is what a response-side candidate filter
// would never see.
export function setCookieInputsAt(origin: Origin, lines: string[]): CaseOf {
  const headers = setCookieLines(lines);

  return {
    static: {
      format: apiDescription({
        request: origin,
        response: { headers: setCookieHeader(...lines) },
      }),
    },
    test: {
      format: apiDescription({ request: origin }),
      respond: respondWith({ headers }),
    },
    analytics: { transactions: [recorded({ origin, headers })] },
  };
}

// The same, served from `SECURE`.
export function setCookieInputs(...lines: string[]): CaseOf {
  return setCookieInputsAt(SECURE, lines);
}

// The fixtures of a rule that holds every Set-Cookie line to one
// requirement: the same violating and conforming lines in every context,
// plus, in `static`, a declared Set-Cookie the description does not pin.
export function setCookieValueFixtures(
  rule: Rule,
  { violates, conforms }: { violates: string[]; conforms: string[] },
): RuleFixtures {
  const violating = setCookieInputs(...violates);
  const conforming = setCookieInputs(...conforms);

  return {
    rule,
    static: {
      violates: violating.static,
      conforms: conforming.static,
      skips: {
        format: apiDescription({ response: { headers: setCookieHeader() } }),
      },
    },
    test: { violates: violating.test, conforms: conforming.test },
    analytics: {
      violates: violating.analytics,
      conforms: conforming.analytics,
    },
  };
}

// The fixtures of a rule on cookies set over plain http, §8.3's conditional
// SHOULD and its convention twin alike: a cookie without Secure over plain
// http is flagged; the same cookie over https passes, and so does a Secure
// cookie over plain http, which a browser ignores and §5.7 step 13's rule
// reports. The server URL fallback is skipped in `static` and `test`, and
// judged as the plain http it is in `analytics`.
export function cookiesOverPlainHttpFixtures(rule: Rule): RuleFixtures {
  const PLAIN_COOKIE = 'SID=31d4d96e407aad42';
  const SECURE_COOKIE = 'SID=31d4d96e407aad42; Secure';

  const violating = setCookieInputsAt(INSECURE, [PLAIN_COOKIE]);
  const fallback = setCookieInputsAt(FALLBACK, [PLAIN_COOKIE]);

  return {
    rule,
    static: {
      violates: violating.static,
      conforms: {
        format: apiDescription(
          { response: { headers: setCookieHeader(PLAIN_COOKIE) } },
          {
            request: INSECURE,
            response: { headers: setCookieHeader(SECURE_COOKIE) },
          },
        ),
      },
      skips: fallback.static,
    },
    test: {
      violates: violating.test,
      conforms: {
        format: apiDescription({}, { request: INSECURE }),
        respond: respondByScheme({
          https: { headers: setCookieLines([PLAIN_COOKIE]) },
          http: { headers: setCookieLines([SECURE_COOKIE]) },
        }),
      },
      skips: fallback.test,
    },
    analytics: {
      violates: fallback.analytics,
      conforms: {
        transactions: [
          recorded({ headers: setCookieLines([PLAIN_COOKIE]) }),
          recorded({
            origin: INSECURE,
            headers: setCookieLines([SECURE_COOKIE]),
          }),
        ],
      },
    },
  };
}
