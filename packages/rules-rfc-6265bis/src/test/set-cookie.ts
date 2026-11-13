// What the rule tests of this package share, so each test file states its
// answers and the executions it expects, and nothing else: where a request
// is served from, a declared Set-Cookie, the Set-Cookie lines a server sends
// or a recording holds, and an API giving such answers, run through `runRule`
// of `@thymian/rules-testing` in one context.
//
// Nothing here ships: `tsconfig.lib.json` and the dependency-checks lint
// leave this directory out.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type {
  HttpResponse,
  Parameter,
  Rule,
  ThymianHttpRequest,
} from '@thymian/core';
import {
  addTransaction,
  createGetRequest,
  createHttpResponse,
  createRequiredParameter,
  createStringSchema,
  createThymianFormat,
} from '@thymian/core-testing';
import {
  recorded,
  type RecordedOverrides,
  type Respond,
  type RuleTestExecution,
  runRule,
} from '@thymian/rules-testing';

import { SET_COOKIE_HEADER } from '../rules/utils/set-cookie.js';

export const contexts = ['static', 'test', 'analytics'] as const;

export type Context = (typeof contexts)[number];

// Where a request is served from.
export type Origin = Pick<ThymianHttpRequest, 'protocol' | 'host' | 'port'>;

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

// A declared header. One value pins it as the schema's `const`, several as
// its `examples`, each one a value the response may carry; without one the
// header is declared but unpinned.
function header(name: string, ...values: string[]): Record<string, Parameter> {
  const [only] = values;
  return {
    [name]: createRequiredParameter({
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
function setCookieHeader(...lines: string[]): Record<string, Parameter> {
  return header(SET_COOKIE_HEADER, ...lines);
}

// The Set-Cookie field lines of one live response: one line is a string,
// several arrive as an array, one entry per field line, as core delivers a
// repeated Set-Cookie without ever splitting it on commas.
function setCookieLines(lines: string[]): HttpResponse['headers'] {
  return { [SET_COOKIE_HEADER]: lines.length === 1 ? lines[0] : lines };
}

// The server under test in `test`: answers as the format declares, and adds
// the headers given for a transaction, declared or not.
function sending(sent: Record<string, HttpResponse['headers']>): Respond {
  return ({ transaction, conforming }) => ({
    ...conforming,
    headers: { ...conforming.headers, ...sent[transaction] },
  });
}

// One response of the API a rule is tested against, and the request it
// answers.
export type Answer = {
  // Where the request is served from; https://api.example.com without one.
  origin?: Origin;
  // The path of the request; one per answer without one.
  path?: string;
  // The status of the response; 200 without one.
  statusCode?: number;
  // The Set-Cookie lines the response carries. An empty list is a Set-Cookie
  // the API description declares without pinning a value, which no server
  // sends and no recording holds; without `lines` there is no Set-Cookie.
  lines?: string[];
  // The other headers the response carries, such as its Date.
  headers?: Record<string, string>;
  // In `analytics`, what the recorded request differs in from the described
  // one, such as the Fetch Metadata a browser sent with it.
  recordedRequest?: RecordedOverrides['request'];
};

// What a rule says, in one context, about an API that gives the answers: the
// executions, and the transaction of each answer, in the order given. The
// headers of an answer are pinned by the API description in `static`, sent by
// the server in `test` and recorded in `analytics`. In `test` and `analytics`
// the description declares none of them: a server sending a Set-Cookie
// anyway is what a rule that only looked at declared headers would never see.
export async function onResponses(
  rule: Rule,
  context: Context,
  answers: Answer[],
): Promise<{ executions: RuleTestExecution[]; transactions: string[] }> {
  const format = createThymianFormat();
  const live: Record<string, HttpResponse['headers']> = {};
  const requests: Record<string, RecordedOverrides['request']> = {};

  const transactions = answers.map((answer, index) => {
    const { origin = SECURE, path = `/${index}`, statusCode = 200 } = answer;
    const { lines, headers = {}, recordedRequest } = answer;
    const transaction = addTransaction(
      format,
      createGetRequest({ ...origin, path }),
      createHttpResponse({
        statusCode,
        headers:
          context === 'static'
            ? Object.assign(
                {},
                lines === undefined ? {} : setCookieHeader(...lines),
                ...Object.entries(headers).map(([name, value]) =>
                  header(name, value),
                ),
              )
            : {},
      }),
    );
    live[transaction] = {
      ...(lines === undefined || lines.length === 0
        ? {}
        : setCookieLines(lines)),
      ...headers,
    };
    requests[transaction] = recordedRequest;
    return transaction;
  });

  const run = runRule(rule);
  const executions =
    context === 'static'
      ? await run.static(format)
      : context === 'test'
        ? await run.test(format, { respond: sending(live) })
        : await run.analytics(format, {
            traffic: transactions.map((transaction) =>
              recorded(format, transaction, {
                request: requests[transaction],
                response: { headers: live[transaction] },
              }),
            ),
          });

  return { executions, transactions };
}

// What a rule says, in one context, about one response that carries the
// Set-Cookie lines, to a request on the path "/" unless `answer` names one.
export async function onOneResponse(
  rule: Rule,
  context: Context,
  lines: string[],
  answer: Omit<Answer, 'lines'> = {},
): Promise<RuleTestExecution> {
  const {
    executions,
    transactions: [answered],
  } = await onResponses(rule, context, [{ path: '/', ...answer, lines }]);

  const [execution, ...others] = executions;
  if (
    execution === undefined ||
    others.length > 0 ||
    typeof execution.location === 'string' ||
    execution.location.elementId !== answered
  ) {
    throw new Error(
      `Expected one execution of ${rule.meta.name}, on the one transaction of the format, but got ${JSON.stringify(executions)}`,
    );
  }
  return execution;
}

// For the tests that hold a topic's rules to "one defect, one violation":
// every `*.rule.ts` in `dir`, informational rules left out, since they run in
// no context.
export async function loadTopicRules(dir: string): Promise<Rule[]> {
  const rules = await Promise.all(
    readdirSync(dir)
      .filter((file) => file.endsWith('.rule.ts'))
      .sort()
      .map(
        async (file) =>
          (
            (await import(pathToFileURL(join(dir, file)).href)) as {
              default: Rule;
            }
          ).default,
      ),
  );
  return rules.filter((rule) => !rule.meta.type.includes('informational'));
}

// The names of the rules that flag the one response carrying `lines`, sorted.
export async function reportedBy(
  rules: Rule[],
  context: Context,
  lines: string[],
  answer: Omit<Answer, 'lines'> = {},
): Promise<string[]> {
  const names: string[] = [];
  for (const rule of rules.filter((r) => r.meta.type.includes(context))) {
    const { status } = await onOneResponse(rule, context, lines, answer);
    if (status === 'failed') {
      names.push(rule.meta.name);
    }
  }
  return names.sort();
}
