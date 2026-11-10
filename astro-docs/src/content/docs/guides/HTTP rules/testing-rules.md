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
  @thymian/plugin-http-linter @thymian/plugin-http-tester @thymian/plugin-http-analyzer \
  vitest
```

The plugins are optional peer dependencies of `@thymian/rules-testing`, and each one is loaded only when a test runs its context. A rule set that declares only `static` needs only `@thymian/plugin-http-linter`.

`@thymian/rules-testing` currently needs `vitest` installed even when your tests run in another framework.

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
