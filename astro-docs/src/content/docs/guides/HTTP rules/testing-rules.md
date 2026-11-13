---
title: 'Testing Rules'
description: 'Test an HTTP rule in every validation context it declares, through the engine that runs it'
sidebar:
  order: 3
---

A rule declares the validation contexts it runs in: `static` (`thymian lint`), `test` (`thymian test`) and `analytics` (`thymian analyze`). A rule test shows, in an ordinary unit test, what the rule says in each of them. It runs the rule through the engine the command uses, and not by calling the rule function directly, because the engine decides what a rule means in a context: the linter asks `appliesTo` of the specification, the analyzer of the recorded traffic, the tester of both.

You describe an API, hand it to `runRule`, and get back a list that says, for **every transaction** of that API, whether the rule flagged it, accepted it or did not speak about it.

```bash
npm install --save-dev @thymian/rules-testing @thymian/core-testing
```

`runRule` returns plain data and needs no particular test framework. The samples on this page use `expect` from [Vitest](https://vitest.dev/); any other assertion on a list of objects does the same. A rule test opens no port, sends nothing over the network and reads no traffic from disk.

Every sample on this page is taken from [a test that runs in the Thymian repository](https://github.com/thymianofficial/thymian/blob/main/packages/rules-testing/test/rule-author-guide.test.ts).

## The two example rules

This guide tests two rules. Both declare all three contexts.

```typescript
import { httpRule, not, responseHeader, statusCode } from '@thymian/core';

export const createdResponsesHaveLocation = httpRule('demo/created-responses-have-location')
  .severity('warn')
  .type('static', 'analytics', 'test')
  .summary('A 201 Created response must name the new resource in a Location header')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions({
      appliesTo: statusCode(201),
      violatedWhen: not(responseHeader('location')),
    }),
  )
  .done();
```

```typescript
import { httpRule, not, responseMediaType, statusCodeRange } from '@thymian/core';

export const clientErrorsAreProblemJson = httpRule('demo/client-errors-are-problem-json')
  .severity('error')
  .type('static', 'analytics', 'test')
  .summary('A 4xx response must answer as application/problem+json')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions({
      appliesTo: statusCodeRange(400, 499),
      violatedWhen: not(responseMediaType('application/problem+json')),
    }),
  )
  .done();
```

## Describe the API

The API a rule is tested against is a Thymian format, built with the factories of `@thymian/core-testing`. `addTransaction` adds one transaction, a request with one response, and returns its id. Keep the id in a variable you name: it is how the test names that transaction from then on.

```typescript
import { addTransaction, createBadRequestResponse, createCreatedResponse, createGetRequest, createNotFoundResponse, createOkResponse, createPostRequest, createRequiredParameter, createStringSchema, createThymianFormat } from '@thymian/core-testing';

const format = createThymianFormat();

const launchesListed = addTransaction(format, createGetRequest({ path: '/launches' }), createOkResponse());
const launchCreated = addTransaction(format, createPostRequest({ path: '/launches' }), createCreatedResponse({ headers: { location: createRequiredParameter() } }));

// A path parameter needs an example, so that a request can be built for it.
const getLaunch = createGetRequest({
  path: '/launches/{id}',
  pathParameters: {
    id: createRequiredParameter({
      schema: createStringSchema({ examples: ['apollo-11'] }),
    }),
  },
});
// One operation with two answers is two transactions on the same request.
const launchFound = addTransaction(format, getLaunch, createOkResponse());
const launchMissing = addTransaction(format, getLaunch, createNotFoundResponse({ mediaType: 'application/problem+json' }));

const createAstronaut = createPostRequest({ path: '/astronauts' });
const astronautCreated = addTransaction(format, createAstronaut, createCreatedResponse());
const astronautRejected = addTransaction(format, createAstronaut, createBadRequestResponse({ mediaType: 'application/json' }));
```

Give the format what the rule should flag, what it should accept and what it should leave alone. With two transactions and "exactly one violation", a rule that flags the wrong one passes too, so a rule test names each transaction and says what is expected of it.

## Run the rule in every context it declares

`runRule(rule)` gives one function per validation context, named as in the rule's `.type(...)`: `static`, `test` and `analytics`. Each takes the format and returns a list of executions, one per transaction, in the order the transactions were added.

```typescript
import { runRule } from '@thymian/rules-testing';

const run = runRule(createdResponsesHaveLocation);

const expected = [
  { location: { elementId: launchesListed }, status: 'notApplicable' },
  { location: { elementId: launchCreated }, status: 'passed' },
  { location: { elementId: launchFound }, status: 'notApplicable' },
  { location: { elementId: launchMissing }, status: 'notApplicable' },
  {
    location: { elementId: astronautCreated },
    status: 'failed',
    severity: 'warn',
    message: 'A 201 Created response must name the new resource in a Location header',
  },
  { location: { elementId: astronautRejected }, status: 'notApplicable' },
];

expect(await run.static(format)).toMatchObject(expected);
expect(await run.test(format)).toMatchObject(expected);
expect(await run.analytics(format)).toMatchObject(expected);
```

The second rule, against the same format:

```typescript
const run = runRule(clientErrorsAreProblemJson);

const expected = [
  { location: { elementId: launchesListed }, status: 'notApplicable' },
  { location: { elementId: launchCreated }, status: 'notApplicable' },
  { location: { elementId: launchFound }, status: 'notApplicable' },
  { location: { elementId: launchMissing }, status: 'passed' },
  { location: { elementId: astronautCreated }, status: 'notApplicable' },
  {
    location: { elementId: astronautRejected },
    status: 'failed',
    severity: 'error',
    message: 'A 4xx response must answer as application/problem+json',
  },
];

expect(await run.static(format)).toMatchObject(expected);
expect(await run.test(format)).toMatchObject(expected);
expect(await run.analytics(format)).toMatchObject(expected);
```

The three contexts agree here because, unless you say otherwise, `test` and `analytics` take everything from the format:

- **`static`** evaluates the rule against the format, as `thymian lint` evaluates it against a specification.
- **`test`** builds a request for each transaction and answers it in-process as the format declares: the declared status, every declared header (required or not) with a value, the declared media type as `content-type`, and a body where the response declares a schema.
- **`analytics`** reads every transaction of the format recorded once: the request `test` would send, answered with that same response.

:::caution[Covering every declared context is your responsibility]
Each context is its own call, and nothing checks that you made all of them. A rule that declares `.type('static', 'analytics', 'test')` and is only run with `run.static(...)` is tested in one context out of three. Call every context the rule declares, also where you expect the same result: the contexts ask `appliesTo` of different things, and a rule can be right in one and silent in another.
:::

Calling a context the rule does **not** declare throws, so a test cannot pass while proving nothing:

```typescript
const lintOnly = httpRule('demo/lint-only')
  .severity('error')
  .type('static')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions({
      appliesTo: statusCode(201),
      violatedWhen: not(responseHeader('location')),
    }),
  )
  .done();

await expect(runRule(lintOnly).test(format)).rejects.toThrow('Rule "demo/lint-only" does not declare the "test" context. It declares: static.');
```

## Read the result

An execution is what the rule said about one location. On a transaction it looks like this:

```typescript
const executions = await runRule(createdResponsesHaveLocation).static(format);

expect(executions).toHaveLength(6);
expect(executions[4]).toMatchObject({
  location: {
    elementType: 'edge',
    elementId: astronautCreated,
    label: 'POST /astronauts (application/json) -> 201 (application/json)',
  },
  status: 'failed',
  severity: 'warn',
  message: 'A 201 Created response must name the new resource in a Location header',
  findings: [],
});
```

| Field      | Meaning                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| `location` | Where the engine located the execution. For a transaction, `elementId` is the id `addTransaction` returned. |
| `status`   | `failed`, `passed`, `notApplicable` or `skipped`.                                                           |
| `message`  | When `failed`: the message of the violation, or the rule's summary or description when the rule gives none. |
| `severity` | When `failed`: the severity the rule declares.                                                              |
| `reason`   | When `skipped`: why.                                                                                        |
| `group`    | When a grouped rule blamed a group as a whole: the group key. See [Grouped rules](#grouped-rules).          |
| `findings` | What the rule attached to the execution, on a pass as much as on a violation. Always a list.                |

Compare with a partial match, as `toMatchObject` does, and write only the fields the test is about. The `label` is there for you: ids are hashes, and the label is what makes a failing comparison say which transaction it is about.

### The four statuses

| Status          | The rule…                                                                     |
| --------------- | ----------------------------------------------------------------------------- |
| `failed`        | applies to the transaction and reports a violation on it.                     |
| `passed`        | applies to the transaction and reports nothing wrong.                         |
| `notApplicable` | does not speak about the transaction: it is outside the rule's `appliesTo`.   |
| `skipped`       | could not be decided for the transaction. The execution carries the `reason`. |

`passed` and `notApplicable` are what show a rule's scope: `passed` proves the rule looked at a transaction and accepted it, `notApplicable` proves it left the transaction alone.

`notApplicable` exists only in a rule test. A report of `thymian lint`, `thymian test` or `thymian analyze` knows `failed`, `passed` and `skipped`.

### Where `passed` and `notApplicable` come from

The linter and the analyzer report only what a rule returns, and a rule returns its violations. A transaction the rule accepted and one it never looked at both simply do not appear. So `runRule` works the difference out itself:

- In **`static`** and **`analytics`**, it reads the `appliesTo` the rule states in its rule-context calls. A transaction inside it that the engine reported nothing on is `passed`; one outside it is `notApplicable`. `static` asks `appliesTo` of the format, `analytics` of the recorded request and response.
- In **`test`**, the tester itself reports `passed` and `skipped` for every transaction it sent a request for. `runRule` takes these as reported and adds only `notApplicable`, for a transaction no request was sent for.

This works when `appliesTo` is a filter expression such as `statusCode(201)`. A rule that decides applicability in a **plain callback** cannot be read from outside, so every transaction it did not flag comes back as `passed`:

```typescript
const decidesInACallback = httpRule('demo/decides-in-a-callback')
  .severity('warn')
  .type('static')
  .summary('A 201 Created response must name the new resource')
  .rule((ctx) =>
    ctx.validateHttpTransactions({
      appliesTo: (_request, response) => response.statusCode === 201,
      violatedWhen: (_request, response) => !('location' in response.headers),
    }),
  )
  .done();

expect(await runRule(decidesInACallback).static(format)).toMatchObject([
  { location: { elementId: launchesListed }, status: 'passed' },
  { location: { elementId: launchCreated }, status: 'passed' },
  { location: { elementId: launchFound }, status: 'passed' },
  { location: { elementId: launchMissing }, status: 'passed' },
  { location: { elementId: astronautCreated }, status: 'failed' },
  { location: { elementId: astronautRejected }, status: 'passed' },
]);
```

This is the same check as `created-responses-have-location`, and the same format, yet the `200`, `404` and `400` answers are `passed` where they were `notApplicable`. The `failed` entries of such a rule are as reliable as any other; its `passed` entries say only "not flagged". Stating `appliesTo` as a filter expression is what makes a rule's scope testable. The same holds for a rule that passes only a violation condition, and in `analytics` for a rule that reads whole traces (`validateCapturedHttpTraces`).

## A server that deviates

In `test`, the server answers as the format declares unless you give `respond`. It is a function that is called for every request and returns the response. It is given the id of the `transaction` the request is aimed at, the `conforming` response, and the `request` that was sent, so you change only what matters:

```typescript
const executions = await runRule(createdResponsesHaveLocation).test(format, {
  respond: ({ transaction, conforming }) => (transaction === launchCreated ? { ...conforming, headers: {} } : conforming),
});

expect(executions[1]).toMatchObject({
  location: { elementId: launchCreated },
  status: 'failed',
});
```

The format declares a `Location` header for `launchCreated`, and the server dropped it: the transaction that was `passed` is now `failed`.

One condition can change many answers. Here every `4xx` answers as HTML, whatever the format declares:

```typescript
const executions = await runRule(clientErrorsAreProblemJson).test(format, {
  respond: ({ conforming }) =>
    conforming.statusCode >= 400
      ? {
          ...conforming,
          headers: {
            ...conforming.headers,
            'content-type': 'text/html',
          },
        }
      : conforming,
});

expect(executions).toMatchObject([
  { location: { elementId: launchesListed }, status: 'notApplicable' },
  { location: { elementId: launchCreated }, status: 'notApplicable' },
  { location: { elementId: launchFound }, status: 'notApplicable' },
  { location: { elementId: launchMissing }, status: 'failed' },
  { location: { elementId: astronautCreated }, status: 'notApplicable' },
  { location: { elementId: astronautRejected }, status: 'failed' },
]);
```

### Another status than declared is `skipped`

A server that answers a transaction with a **different status than the format declares** makes that transaction `skipped`, not `failed`. The tester does not ask the rule about it, exactly as `thymian test` does not:

```typescript
const executions = await runRule(createdResponsesHaveLocation).test(format, {
  respond: ({ transaction, conforming }) => (transaction === launchCreated ? { ...conforming, statusCode: 500 } : conforming),
});

expect(executions[1]).toMatchObject({
  location: { elementId: launchCreated },
  status: 'skipped',
  reason: expect.stringContaining('Expected status code 201, but received 500'),
});
```

So `respond` cannot turn a `201` into a `400` to see what the rule says about a `400`. Add a transaction that declares the `400` instead.

## Traffic you hand in

In `analytics`, the traffic is every transaction recorded once, conforming, unless you give `traffic`: a list of recorded pairs, each a request and its response as plain HTTP objects. `recorded(format, transactionId)` gives the conforming pair of a transaction:

```typescript
import { recorded } from '@thymian/rules-testing';

expect(recorded(format, launchMissing)).toMatchObject({
  request: {
    method: 'GET',
    origin: 'https://localhost:443',
    path: '/launches/apollo-11',
  },
  response: {
    statusCode: 404,
    headers: { 'content-type': 'application/problem+json' },
  },
});
```

Its third argument overrides parts of the request or the response, so you write only what deviates. A transaction may be recorded several times, and each recording is judged on its own. Here `launchCreated` is recorded twice, once as declared and once without its `Location` header:

```typescript
const executions = await runRule(createdResponsesHaveLocation).analytics(format, {
  traffic: [recorded(format, launchCreated), recorded(format, launchCreated, { response: { headers: {} } })],
});

expect(executions).toMatchObject([
  // The recordings, in traffic order
  { location: { elementId: launchCreated }, status: 'passed' },
  { location: { elementId: launchCreated }, status: 'failed' },
  // Then the transactions that were never recorded
  { location: { elementId: launchesListed }, status: 'notApplicable' },
  { location: { elementId: launchFound }, status: 'notApplicable' },
  { location: { elementId: launchMissing }, status: 'notApplicable' },
  { location: { elementId: astronautCreated }, status: 'notApplicable' },
  { location: { elementId: astronautRejected }, status: 'notApplicable' },
]);
```

Three things differ from the list `static` gives:

- **One entry per recording,** in traffic order. Both recordings are located on `launchCreated`, the transaction they match, so you name it by the same id as in the other contexts.
- **A transaction that was never recorded is `notApplicable`,** and comes after the recordings. `astronautCreated`, which `static` flags, is not flagged here: there is no traffic of it to judge.
- **Any other location comes last.** A recording that matches no transaction of the format, for example one with another path, has no transaction to appear on. What the rule says about it is located on a free string, the label of the recording:

```typescript
const executions = await runRule(createdResponsesHaveLocation).analytics(format, {
  traffic: [
    recorded(format, launchCreated, {
      request: { path: '/probes' },
      response: { headers: {} },
    }),
  ],
});

expect(executions.at(-1)).toMatchObject({
  location: expect.stringContaining('/probes'),
  status: 'failed',
});
```

### What an override replaces

An override replaces a field of the conforming request or response as a whole: `headers` given in an override are all the headers of that recording. One header is kept. The analyzer recognises a transaction in a recording by method, origin, path, status and media types, so the media type the format declares stays named as `content-type` unless the headers you give name one themselves:

```typescript
const kept = recorded(format, launchMissing, {
  response: { headers: { 'retry-after': '120' } },
});
const replaced = recorded(format, launchMissing, {
  response: { headers: { 'content-type': 'text/html' } },
});

expect(kept.response.headers).toEqual({
  'retry-after': '120',
  'content-type': 'application/problem+json',
});
expect(replaced.response.headers).toEqual({ 'content-type': 'text/html' });
```

A recording that names another `content-type` than the format declares is therefore no longer a recording of that transaction. The transaction is `notApplicable`, and what the rule says about the recording comes last, on its label:

```typescript
const executions = await runRule(clientErrorsAreProblemJson).analytics(format, {
  traffic: [
    recorded(format, launchMissing, {
      response: { headers: { 'content-type': 'text/html' } },
    }),
  ],
});

expect(executions).toMatchObject([
  { location: { elementId: launchesListed }, status: 'notApplicable' },
  { location: { elementId: launchCreated }, status: 'notApplicable' },
  { location: { elementId: launchFound }, status: 'notApplicable' },
  { location: { elementId: launchMissing }, status: 'notApplicable' },
  { location: { elementId: astronautCreated }, status: 'notApplicable' },
  { location: { elementId: astronautRejected }, status: 'notApplicable' },
  { location: expect.stringContaining('/launches'), status: 'failed' },
]);
```

The same holds for a pair you write by hand: to be recognised as a transaction of the format, it has to carry the media types the format declares as `content-type`.

## Grouped rules

A rule that compares several transactions with each other (`validateGroupedCommonHttpTransactions`) says what is at fault by the location it returns, and a rule test shows both readings. The two rules below make the same check, that a resource sends `ETag` on every `200` answer or on none, and differ only in what they blame.

```typescript
const format = createThymianFormat();
const launchRead = addTransaction(format, createGetRequest({ path: '/launches' }), createOkResponse({ headers: { etag: createRequiredParameter() } }));
const launchReplaced = addTransaction(format, createPutRequest({ path: '/launches' }), createOkResponse());
const launchCreated = addTransaction(format, createPostRequest({ path: '/launches' }), createCreatedResponse());
const astronautRead = addTransaction(format, createGetRequest({ path: '/astronauts' }), createOkResponse());
```

### The rule blames one member

A rule that returns the location of one member of the group says that this transaction is wrong:

```typescript
const message = 'A resource sends ETag on every 200 answer or on none';

// Blames one member: the answer without an ETag.
const answersCarryTheEtagOfTheirResource = httpRule('demo/answers-carry-the-etag-of-their-resource')
  .severity('error')
  .type('static', 'analytics', 'test')
  .summary(message)
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions({
      appliesTo: statusCode(200),
      groupBy: url(),
      violatedWhen: (_key, answers) => {
        const withoutEtag = answers.filter(([, response]) => !response.headers.includes('etag'));

        return withoutEtag.length === answers.length
          ? []
          : withoutEtag.map(([, , location]) => ({
              location,
              violation: {},
              findings: [],
            }));
      },
    }),
  )
  .done();
```

That member is `failed`, and the other members of its group are `passed`:

```typescript
const run = runRule(answersCarryTheEtagOfTheirResource);

const expected = [
  { location: { elementId: launchRead }, status: 'passed' },
  { location: { elementId: launchReplaced }, status: 'failed', message },
  { location: { elementId: launchCreated }, status: 'notApplicable' },
  { location: { elementId: astronautRead }, status: 'passed' },
];

expect(await run.static(format)).toMatchObject(expected);
expect(await run.test(format)).toMatchObject(expected);
expect(await run.analytics(format)).toMatchObject(expected);
```

### The rule blames the group

A rule that returns the group key, the first argument of `violatedWhen`, says that the group as a whole is wrong:

```typescript
// Blames the group: the resource as a whole.
const resourcesSendEtagConsistently = httpRule('demo/resources-send-etag-consistently')
  .severity('error')
  .type('static', 'analytics', 'test')
  .summary(message)
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions({
      appliesTo: statusCode(200),
      groupBy: url(),
      violatedWhen: (key, answers) => {
        const withEtag = answers.filter(([, response]) => response.headers.includes('etag'));

        return withEtag.length === 0 || withEtag.length === answers.length ? [] : [{ location: key, violation: {}, findings: [] }];
      },
    }),
  )
  .done();
```

Every member of the group is then `failed`, and each of these executions carries the key as `group`:

```typescript
const run = runRule(resourcesSendEtagConsistently);

const blamed = {
  status: 'failed',
  message,
  group: expect.stringContaining('/launches'),
};
const expected = [
  { location: { elementId: launchRead }, ...blamed },
  { location: { elementId: launchReplaced }, ...blamed },
  { location: { elementId: launchCreated }, status: 'notApplicable' },
  { location: { elementId: astronautRead }, status: 'passed' },
];

expect(await run.static(format)).toMatchObject(expected);
expect(await run.test(format)).toMatchObject(expected);
expect(await run.analytics(format)).toMatchObject(expected);
```

The key is what the context grouped by, spelled as that context spells it, so match it loosely when one expectation serves several contexts:

```typescript
const run = runRule(resourcesSendEtagConsistently);

const [inStatic] = await run.static(format);
const [inAnalytics] = await run.analytics(format);

expect(inStatic?.group).toBe('https://localhost:443/launches');
expect(inAnalytics?.group).toBe('https://localhost/launches');
```

## Limits you will meet

- **A path parameter without an example.** A request cannot be built for it. In `test` the transaction is `skipped`, with the reason `Missing value for path parameter "id".`; in `analytics` the call throws, because there is nothing to record. Give the parameter's schema an example, as `getLaunch` does above.
- **A group in `test` is sent together.** A server that answers one member of a group with another status than declared makes every member of that group `skipped`.
- **A transaction recorded several times, under a rule that compares.** The analyzer names the transaction an execution is about, not the recording. For a rule that judges each recording on its own, `runRule` still tells the recordings apart, as shown above. What a grouped rule, or a rule that compares recordings with each other, reports on a transaction appears on **every** recording of it:

  ```typescript
  const executions = await runRule(resourcesSendEtagConsistently).analytics(format, {
    traffic: [recorded(format, launchRead), recorded(format, launchReplaced), recorded(format, launchReplaced)],
  });

  expect(executions).toMatchObject([
    { location: { elementId: launchRead }, status: 'failed' },
    { location: { elementId: launchReplaced }, status: 'failed' },
    { location: { elementId: launchReplaced }, status: 'failed' },
    { location: { elementId: launchCreated }, status: 'notApplicable' },
    { location: { elementId: astronautRead }, status: 'notApplicable' },
  ]);
  ```

- **Transactions a recording cannot tell apart.** Two answers of one request with the same status and media type match neither in `analytics`: both are `notApplicable`, and an execution on their recording keeps its label.

## More

- **Options.** `runRule(rule, { options })` hands the rule its options as a configuration does. One call is one configuration, and options the rule's schema does not accept make `runRule` throw.
- **Severity `off`.** A rule that ships switched off runs like any other. A `failed` execution carries the severity the rule declares, here `off`.
- **Skips and findings.** A rule that skips a transaction itself yields a `skipped` execution with the reason it gave. Anything else it attaches comes back in `findings`.

The [`@thymian/rules-testing` README](https://github.com/thymianofficial/thymian/tree/main/packages/rules-testing#readme) is the reference for all of it. For rule tests of real rules, see the tests beside the rules of [`@thymian/rules-rfc-6797`](https://github.com/thymianofficial/thymian/tree/main/packages/rules-rfc-6797/src/rules) and [`@thymian/rules-rfc-6265bis`](https://github.com/thymianofficial/thymian/tree/main/packages/rules-rfc-6265bis/src/rules).

## Next Steps

- Learn how to [create rules](/guides/http-rules/creating-new-rules/)
- See what `appliesTo` means in each context in [combining rule types](/guides/http-rules/combining-types/)
- Explore [rule types in depth](/concepts/rule-types/)
