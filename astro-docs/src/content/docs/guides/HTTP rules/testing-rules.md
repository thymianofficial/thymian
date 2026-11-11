---
title: 'Testing Rules'
description: 'Test your HTTP rules in every validation context with @thymian/rules-testing'
sidebar:
  order: 3
---

A rule that declares all three validation contexts, lint, test and analyze, makes a claim about three engines: the linter, the tester and the analyzer. `@thymian/rules-testing` lets you check that claim. It runs one rule in one validation context through that context's real engine, the same way `thymian lint`, `thymian test` and `thymian analyze` run it, and hands back what the rule reported. A passing test therefore shows that the rule works in that context, not only that the rule function returns something.

It does not assert anything itself. You make the assertions, in whatever test framework you use. The examples below use [Vitest](https://vitest.dev).

## Installation

Install `@thymian/rules-testing` as a dev dependency, together with `@thymian/core` and the validation plugin for **each context your rules declare**:

| Context     | Plugin                          | CLI command       |
| ----------- | ------------------------------- | ----------------- |
| `static`    | `@thymian/plugin-http-linter`   | `thymian lint`    |
| `test`      | `@thymian/plugin-http-tester`   | `thymian test`    |
| `analytics` | `@thymian/plugin-http-analyzer` | `thymian analyze` |

For a rule set that declares all three:

```bash
npm install --save-dev @thymian/core @thymian/rules-testing \
  @thymian/plugin-http-linter @thymian/plugin-http-tester @thymian/plugin-http-analyzer
```

The plugins are optional peer dependencies of `@thymian/rules-testing`, and each one is loaded only when a test runs its context. A rule set that declares only `static` needs only `@thymian/plugin-http-linter`.

### Versions

Install `@thymian/rules-testing` at the **same version** as `@thymian/core` and the plugins. Its peer dependencies are pinned to that exact version, so npm rejects a mismatch rather than letting a test run against an engine from another release.

## A Rule to Test

The examples on this page test one rule. It flags every response that reveals the server software in a `Server` header, in all three contexts:

```typescript
import { constant, httpRule, responseHeader } from '@thymian/core';

export default httpRule('my-rules/no-server-header')
  .severity('warn')
  .type('static', 'test', 'analytics')
  .description('Responses should not reveal the server software')
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions({
      appliesTo: constant(true),
      violatedWhen: responseHeader('server'),
    }),
  )
  .done();
```

## Running a Rule in a Context

`runInContext(context, rule, input)` runs `rule` in `context` and resolves to the `RuleFnResult[]` the rule reported. A result with a `violation` is a violation. The `input` depends on the context: it is what that context's command would have in hand.

This section shows each context's own input. When your inputs are plain data, one [`observed` list](#one-observed-list-for-every-context) can drive all three contexts instead, and is the shorter way to write a `test` input.

### Lint (`'static'`): an API Specification

`thymian lint` reads an API specification, so a `StaticInput` is a `ThymianFormat`. Build one with `addHttpTransaction`, one described request and response at a time:

```typescript
import { type Parameter, ThymianFormat } from '@thymian/core';
import { runInContext } from '@thymian/rules-testing';
import { expect, it } from 'vitest';

import rule from './no-server-header.rule.js';

// An API specification with one operation, GET /orders, whose 200 response
// declares the given headers.
function apiSpecification(responseHeaders: Record<string, Parameter> = {}): ThymianFormat {
  const format = new ThymianFormat();
  format.addHttpTransaction(
    {
      type: 'http-request',
      protocol: 'https',
      host: 'api.example.com',
      port: 443,
      path: '/orders',
      method: 'GET',
      headers: {},
      queryParameters: {},
      cookies: {},
      pathParameters: {},
      mediaType: '',
    },
    { type: 'http-response', statusCode: 200, headers: responseHeaders, mediaType: '' },
    'my-tests',
  );
  return format;
}

const serverHeader: Record<string, Parameter> = {
  server: {
    required: true,
    schema: { type: 'string' },
    style: { style: 'simple', explode: false },
  },
};

it('flags a described Server header', async () => {
  const results = await runInContext('static', rule, {
    format: apiSpecification(serverHeader),
  });

  expect(results.filter((result) => result.violation)).toHaveLength(1);
});
```

### Test (`'test'`): a Server Under Test

`thymian test` sends the requests the API specification implies and judges the responses. A `TestInput` takes the specification as `format`, and a `runRequest` function that stands in for the server: it receives each request and returns the response.

```typescript
import type { TestInput } from '@thymian/rules-testing';

// The server under test: answers every request with these headers.
function respondWith(headers: Record<string, string>): TestInput['runRequest'] {
  return async () => ({ statusCode: 200, headers, trailers: {}, duration: 1 });
}

it('flags a Server header the server sends', async () => {
  const results = await runInContext('test', rule, {
    format: apiSpecification(),
    runRequest: respondWith({ server: 'nginx/1.27.0' }),
  });

  expect(results.filter((result) => result.violation)).toHaveLength(1);
});
```

The specification here declares no `Server` header at all. In `test`, the rule judges the response that came back, not the one the specification promised.

A `TestInput` can also replace how requests are sampled from the specification (`sampleRequest`), how hooks run (`runHook`), and the `locals` they share. Each has a default, so a test sets them only when the rule depends on them.

`respondWith` answers every request alike, which is all this rule needs. Once the answer depends on which `Operation` was called, `runRequest` turns into a router you keep in step with the specification by hand; an [`observed` list](#rules-scoped-to-endpoints) does that for you.

### Analyze (`'analytics'`): Recorded Traffic

`thymian analyze` reads traffic that was recorded earlier. An `AnalyticsInput` takes `transactions`, each a request and the response it got, and `traces`, each a list of transactions that belong together, such as the hops of one request through a proxy:

```typescript
import type { CapturedTransaction } from '@thymian/core';

// One recorded GET /orders, answered with these headers.
function recorded(headers: Record<string, string>): CapturedTransaction {
  return {
    request: {
      data: { origin: 'https://api.example.com', path: '/orders', method: 'get', headers: {} },
      meta: { role: 'user-agent' },
    },
    response: {
      data: { statusCode: 200, headers, trailers: {}, duration: 1 },
      meta: { role: 'origin server' },
    },
  };
}

it('flags a recorded Server header', async () => {
  const results = await runInContext('analytics', rule, {
    transactions: [recorded({ server: 'nginx/1.27.0' })],
  });

  expect(results.filter((result) => result.violation)).toHaveLength(1);
});

it('flags a Server header anywhere in a trace', async () => {
  const results = await runInContext('analytics', rule, {
    traces: [[recorded({}), recorded({ server: 'nginx/1.27.0' })]],
  });

  expect(results.filter((result) => result.violation)).toHaveLength(1);
});
```

Both are optional. An `AnalyticsInput` can also carry a `format`, for a rule that compares the traffic with the API specification.

## Configuring the Rule

Every input takes `config`, the rule's configuration exactly as a Thymian config file would give it: either a severity, or an object with `severity`, `type`, `skipOrigins` and `options`.

```typescript
// Run the rule as a project would configure it.
await runInContext('analytics', rule, {
  transactions: [recorded({ server: 'nginx/1.27.0' })],
  config: { severity: 'error', skipOrigins: ['https://api.example.com'] },
});
```

Two cases are worth knowing:

- **A rule shipped `off` runs at `warn`.** Thymian skips a rule whose severity is `off`, so a test of such a rule would pass without running it. `runInContext` therefore runs it at `warn` unless `config` gives it a severity. A severity you give always wins.
- **`config: 'off'` turns the rule off**, and `runInContext` resolves to `[]`. So does a context the rule does not run in, whether it never declared it or `config.type` takes it away.

Every input also takes a `logger`. Without one, the rule's log output is discarded.

## Fixtures and `checkInput`

Most rule tests make the same two claims per context: this input must be flagged, and that one must pass. `@thymian/rules-testing` gives that shape a type, so you can write the inputs as data and check them all with one loop.

- A **`ContextFixture`** is one context's inputs: `violates`, an input the rule must flag, and `conforms`, an input it must pass. An optional `skips` is for a rule that cannot decide some input in that context and must say so with a `rule-skip` finding rather than pass silently.
- A **`RuleFixtures`** is the rule plus one `ContextFixture` per context.
- **`checkInput(context, rule, input, expected)`** runs the input like `runInContext` and says whether it kept its promise. It resolves to `{ met, reason, results }`: `met` is `true` or `false`, `reason` says what went wrong when it is `false`, and `results` is what the rule reported.

| `expected` | `met` when the rule reports                     |
| ---------- | ----------------------------------------------- |
| `violates` | at least one violation                          |
| `conforms` | no violation and no skip                        |
| `skips`    | no violation, and at least one skip of the rule |

With the helpers from above:

```typescript
import { checkInput, type RuleFixtures, validationContexts } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

const fixtures: RuleFixtures = {
  rule,
  static: {
    violates: { format: apiSpecification(serverHeader) },
    conforms: { format: apiSpecification() },
  },
  test: {
    violates: { format: apiSpecification(), runRequest: respondWith({ server: 'nginx/1.27.0' }) },
    conforms: { format: apiSpecification(), runRequest: respondWith({}) },
  },
  analytics: {
    violates: { transactions: [recorded({ server: 'nginx/1.27.0' })] },
    conforms: { transactions: [recorded({})] },
  },
};

describe.each(validationContexts)('in %s', (context) => {
  const fixture = fixtures[context];
  if (fixture === undefined) {
    return;
  }

  it.each(['violates', 'conforms'] as const)('%s', async (expected) => {
    const verdict = await checkInput(context, fixtures.rule, fixture[expected], expected);

    expect(verdict.met, verdict.reason).toBe(true);
  });
});
```

`validationContexts` lists the three contexts. Passing `verdict.reason` as the assertion message makes a failure read, for example, ``the `violates` input of my-rules/no-server-header in `test` should be flagged, but it got 0 violations and 0 skips in 0 results``.

Thymian's own rule sets add a bar on top; you don't have to.

## One `observed` List for Every Context

The fixtures above say the same thing three times: the specification declares a `Server` header, the server sends one, the recorded traffic holds one. Each context needs it in its own shape. An `observed` list says it once, and `runInContext` derives what each context's engine needs from it.

Each row of the list is an `ObservedTransaction`: one `Transaction` as the API specification describes it, and what was actually observed for it.

```typescript
import type { Parameter } from '@thymian/core';
import type { ObservedTransaction } from '@thymian/rules-testing';

// GET <path> as the API specification describes it: a 200 response that
// declares the given headers.
function describedGet(path: string, responseHeaders: Record<string, Parameter> = {}): ObservedTransaction['described'] {
  return {
    request: {
      type: 'http-request',
      label: `GET ${path}`,
      sourceName: 'my-tests',
      protocol: 'https',
      host: 'api.example.com',
      port: 443,
      path,
      method: 'GET',
      headers: {},
      queryParameters: {},
      cookies: {},
      pathParameters: {},
      mediaType: '',
    },
    response: {
      type: 'http-response',
      label: '200',
      sourceName: 'my-tests',
      statusCode: 200,
      headers: responseHeaders,
      mediaType: '',
    },
  };
}

const revealing: ObservedTransaction = {
  // The specification declares a Server header for GET /orders ...
  described: describedGet('/orders', serverHeader),
  // ... and the server sent one.
  actual: { response: { headers: { server: 'nginx/1.27.0' } } },
};
```

Each context reads the part of the row it would have in hand:

| Context     | Reads                    | What it makes of the row                                                                                                                                                                                                                                            |
| ----------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `static`    | `described`              | One `Transaction` of the API specification. `secured: true` marks its request as secured.                                                                                                                                                                           |
| `test`      | `described` and `actual` | The request is sampled from `described.request`, with the fields of `actual.request` in place of the sampled ones. The server under test answers it with `actual.response`.                                                                                         |
| `analytics` | `actual`                 | One recorded transaction: the request `test` would send, and `actual.response` as the answer, between a `user-agent` and an `origin server` unless `actual.roles` names other participants. A templated path is recorded at the concrete path the sampler gives it. |

Every part of `actual` is optional. Without `actual.response`, the answer has the described status code, no headers, no trailers and a duration of 1. `secured` defaults to `false`.

An `ObservedInput` is `{ observed }`, plus `config` and `logger` as on every input. Every context accepts it:

```typescript
import { type ObservedInput, runInContext, validationContexts } from '@thymian/rules-testing';

const revealingInput: ObservedInput = { observed: [revealing] };

it.each(validationContexts)('flags a Server header in %s', async (context) => {
  const results = await runInContext(context, rule, revealingInput);

  expect(results.filter((result) => result.violation)).toHaveLength(1);
});
```

An `ObservedInput` replaces a context's own fields: it cannot be combined with `format`, `runRequest` or `transactions` in one input.

### Fixtures From One List

When a rule makes the same assertion in every context it declares, `inDeclaredContexts(rule, { violates, conforms, skips? })` builds its `RuleFixtures` from `observed` inputs: one `ContextFixture` for each context in the rule's `.type(...)`, each with the same inputs.

```typescript
import { inDeclaredContexts, type ObservedInput } from '@thymian/rules-testing';

// The same GET /orders, described and answered without a Server header.
const discreetInput: ObservedInput = { observed: [{ described: describedGet('/orders') }] };

const fixtures = inDeclaredContexts(rule, {
  violates: revealingInput,
  conforms: discreetInput,
});
```

These fixtures run through the same `checkInput` loop as before. To give one context other inputs, spread the result and replace that context's entry:

```typescript
const fixturesWithTraces: RuleFixtures = {
  ...inDeclaredContexts(rule, { violates: revealingInput, conforms: discreetInput }),
  analytics: {
    violates: { traces: [[recorded({}), recorded({ server: 'nginx/1.27.0' })]] },
    conforms: { traces: [[recorded({}), recorded({})]] },
  },
};
```

### What `test` Rejects

`test` sends requests and has to answer each one from the list, so it rejects two inputs that `static` and `analytics` would accept. In both cases `runInContext`, and so `checkInput`, rejects rather than resolving to results:

- **A request no row answers.** A sent request is answered by the row it was sampled from, found by its method, origin and path. A row whose `actual.request` moves the request elsewhere, say to another path, leaves it unanswered, and the error names the request: ``no row of `observed` answers GET /elsewhere``.
- **Two rows for one `Operation`.** `POST /orders → 201` and `POST /orders → 400` are two rows `test` cannot tell apart, because their sampled requests are the same. Give `test` one row per `Operation`, and put the other answer in a second input. `analytics` accepts several rows for one `Operation`, and records each.

### When a List Is Not Enough

The context inputs from [Running a Rule in a Context](#running-a-rule-in-a-context) remain the way to express what one row per `Transaction` cannot:

- a server whose answer depends on the request it receives, keeps state between requests, or fails to answer: write `runRequest`;
- a rule that depends on how requests are sampled or how hooks run: set `sampleRequest`, `runHook` or `locals`;
- traffic that belongs together, such as the hops of one request through a proxy: give `analytics` its `traces`.

## Rules Scoped to Endpoints

Most rules apply only to some `Operation`s: this one only to `GET /orders`.

```typescript
import { and, httpRule, method, path, responseHeader } from '@thymian/core';

export default httpRule('my-rules/no-server-header-on-orders')
  .severity('warn')
  .type('static', 'test', 'analytics')
  .description('Listing orders should not reveal the server software')
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions({
      appliesTo: and(method('GET'), path('/orders')),
      violatedWhen: responseHeader('server'),
    }),
  )
  .done();
```

A test of such a rule shows both halves of its scope: it flags the `Operation` it applies to, and leaves every other one alone. Give it one list with an in-scope row and an out-of-scope row that would be flagged if the rule applied to it, and expect exactly one violation in every context:

```typescript
import { type ObservedTransaction, runInContext, validationContexts } from '@thymian/rules-testing';

import rule from './no-server-header-on-orders.rule.js';

// GET <path>, described and answered with a Server header.
function revealingAt(path: string): ObservedTransaction {
  return {
    described: describedGet(path, serverHeader),
    actual: { response: { headers: { server: 'nginx/1.27.0' } } },
  };
}

it.each(validationContexts)('flags GET /orders and nothing else in %s', async (context) => {
  const results = await runInContext(context, rule, {
    observed: [revealingAt('/orders'), revealingAt('/customers')],
  });

  expect(results.filter((result) => result.violation)).toHaveLength(1);
});
```

In `test`, prefer this over a hand-written `runRequest`. Two `Operation`s with different answers would otherwise need a `runRequest` that routes on `request.method` and `request.path`, builds a complete response for each, and has to be kept in step with the specification by hand. An `observed` list builds the specification and the server from the same rows, so they cannot drift apart.

## When a Plugin Is Missing

Running a context whose plugin is not installed rejects with an error that names both:

```
Error: the `test` context needs `@thymian/plugin-http-tester`
```

Install that plugin as a dev dependency, at the same version as `@thymian/core`. Any other error while loading a plugin, such as one of its own dependencies missing, is passed through unchanged.

## Next Steps

- Learn how to [create new rules](/guides/http-rules/creating-new-rules/)
- Understand the [rule types](/concepts/rule-types/) behind the three contexts
- See [how to use rules](/guides/http-rules/how-to-use-rules/) and bundle them into a rule set
