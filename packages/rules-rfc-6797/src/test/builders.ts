// Fixture inputs, one builder per thing a fixture needs to say: an API
// description, what the server answers in `test`, and a recorded
// transaction for `analytics`.

import {
  type CapturedTransaction,
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
import { defineFixtures, type RuleFixtures } from './harness.js';

export const SECURE = {
  protocol: 'https',
  host: 'api.example.com',
  port: 443,
} as const satisfies Partial<ThymianHttpRequest>;

export const INSECURE = {
  protocol: 'http',
  host: 'api.example.com',
  port: 80,
} as const satisfies Partial<ThymianHttpRequest>;

// What a document with no usable `servers` entry loads as
// (thymianofficial/thymian-workspace#81).
export const FALLBACK = {
  protocol: 'http',
  host: 'localhost',
  port: 8080,
} as const satisfies Partial<ThymianHttpRequest>;

export const SECURE_ORIGIN = 'https://api.example.com';

// A response's headers carrying a well-formed one-year policy.
export const STS_ONE_YEAR: HttpResponse['headers'] = {
  [STS_HEADER]: 'max-age=31536000',
};
export const INSECURE_ORIGIN = 'http://api.example.com';

// A declared response header. A value pins it as the schema's `const`;
// without one the header is declared but unpinned.
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

type DescribedTransaction = {
  request?: Partial<ThymianHttpRequest>;
  response?: Partial<ThymianHttpResponse>;
};

// An API description; every request is served over https unless it says
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

// The server under test in `test`: answers every request alike.
export function respondWith({
  statusCode = 200,
  headers = {},
}: {
  statusCode?: number;
  headers?: HttpResponse['headers'];
}): () => HttpResponse {
  return () => ({ statusCode, headers, trailers: {}, duration: 1 });
}

// One recorded transaction, as an origin server answered a user agent.
export function recorded({
  origin = SECURE_ORIGIN,
  path = '/',
  statusCode = 200,
  headers = {},
}: {
  origin?: string;
  path?: string;
  statusCode?: number;
  headers?: HttpResponse['headers'];
}): CapturedTransaction {
  return {
    request: {
      data: { origin, path, method: 'get', headers: {} },
      meta: { role: 'user-agent' },
    },
    response: {
      data: { statusCode, headers, trailers: {}, duration: 1 },
      meta: { role: 'origin server' },
    },
  };
}

// The three fixtures of a rule that holds every Strict-Transport-Security
// value to one requirement: the same violating and conforming value, pinned
// by an API description, answered by a server under test, and recorded —
// plus, in `static`, a declared value the description does not pin.
export function stsValueFixtures(
  rule: Rule,
  { violates, conforms }: { violates: string; conforms: string },
): RuleFixtures {
  const sts = (value: string) => ({ [STS_HEADER]: value });

  return defineFixtures({
    rule,
    static: {
      violates: {
        format: apiDescription({ response: { headers: stsHeader(violates) } }),
      },
      conforms: {
        format: apiDescription({ response: { headers: stsHeader(conforms) } }),
      },
      skips: {
        format: apiDescription({ response: { headers: stsHeader() } }),
      },
    },
    test: {
      violates: {
        format: apiDescription({}),
        respond: respondWith({ headers: sts(violates) }),
      },
      conforms: {
        format: apiDescription({}),
        respond: respondWith({ headers: sts(conforms) }),
      },
    },
    analytics: {
      violates: { transactions: [recorded({ headers: sts(violates) })] },
      conforms: { transactions: [recorded({ headers: sts(conforms) })] },
    },
  });
}
