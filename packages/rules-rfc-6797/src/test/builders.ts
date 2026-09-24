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

import { STS_HEADER } from '../rules/utils/sts-field-value.js';
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

// A declared header. A value pins it as the schema's `const`; without one
// the header is declared but unpinned.
export function header(
  name: string,
  value?: string,
): Record<string, Parameter> {
  return {
    [name]: createParameter({
      required: true,
      schema:
        value === undefined
          ? createStringSchema()
          : createStringSchema({ const: value }),
    }),
  };
}

export function stsHeader(value?: string): Record<string, Parameter> {
  return header(STS_HEADER, value);
}

// The headers of a response carrying one well-formed, one-year policy.
export const STS_ONE_YEAR: HttpResponse['headers'] = {
  [STS_HEADER]: 'max-age=31536000',
};

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
export function recorded({
  origin = SECURE,
  path = '/',
  statusCode = 200,
  headers = {},
}: {
  origin?: Origin;
  path?: string;
  statusCode?: number;
  headers?: HttpResponse['headers'];
}): CapturedTransaction {
  return {
    request: {
      data: { origin: originOf(origin), path, method: 'get', headers: {} },
      meta: { role: 'user-agent' },
    },
    response: {
      data: { statusCode, headers, trailers: {}, duration: 1 },
      meta: { role: 'origin server' },
    },
  };
}

// One Strict-Transport-Security value in every context: pinned by an API
// description, answered by a server under test, and recorded. In `test` the
// description declares no header at all: the server sending one anyway is
// what a response-side candidate filter would never see.
export function stsValueInputs(value: string): CaseOf {
  const headers = { [STS_HEADER]: value };

  return {
    static: {
      format: apiDescription({ response: { headers: stsHeader(value) } }),
    },
    test: { format: apiDescription({}), respond: respondWith({ headers }) },
    analytics: { transactions: [recorded({ headers })] },
  };
}

// The fixtures of a rule that holds every Strict-Transport-Security value to
// one requirement: the same violating and conforming value in every context,
// plus, in `static`, a declared value the description does not pin.
export function stsValueFixtures(
  rule: Rule,
  { violates, conforms }: { violates: string; conforms: string },
): RuleFixtures {
  const violating = stsValueInputs(violates);
  const conforming = stsValueInputs(conforms);

  return {
    rule,
    static: {
      violates: violating.static,
      conforms: conforming.static,
      skips: {
        format: apiDescription({ response: { headers: stsHeader() } }),
      },
    },
    test: { violates: violating.test, conforms: conforming.test },
    analytics: {
      violates: violating.analytics,
      conforms: conforming.analytics,
    },
  };
}
