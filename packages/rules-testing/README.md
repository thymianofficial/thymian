<!-- HEADER:START - Do not remove or modify this section -->
<div align="center">
  <img src="https://raw.githubusercontent.com/thymianofficial/thymian/main/astro-docs/src/assets/logo.svg" alt="Thymian Logo" width="200"/>

# Thymian

**Add resilience and HTTP conformance to your API development workflow**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-green.svg)](https://github.com/thymianofficial/thymian/blob/main/LICENSE)
[![CI](https://github.com/thymianofficial/thymian/actions/workflows/ci.yaml/badge.svg)](https://github.com/thymianofficial/thymian/actions/workflows/ci.yaml)
[![Documentation](https://img.shields.io/badge/docs-thymian.dev-green.svg)](https://thymian.dev)
[![Discord](https://img.shields.io/discord/1440702693768429791?logo=discord&label=Discord&color=5865F2)](https://discord.gg/TRSwCxbz9f)
[![Reddit](https://img.shields.io/badge/Reddit-ThymianOfficial-FF4500?logo=reddit)](https://www.reddit.com/r/ThymianOfficial/)
[![Twitter](https://img.shields.io/badge/Twitter-@thymiandev-1DA1F2?logo=x)](https://x.com/thymiandev)

</div>
<!-- HEADER:END -->

## @thymian/rules-testing

Test a rule through the real engine of a validation context it declares. You build the API the rule is tested against as a Thymian format with the factories of `@thymian/core-testing`, hand it to `runRule`, and get back plain data: one execution per transaction of the format. No test framework is required or assumed.

## Installation

```bash
npm install --save-dev @thymian/rules-testing @thymian/core-testing
```

## Usage

```typescript
import { addTransaction, createBadRequestResponse, createCreatedResponse, createGetRequest, createOkResponse, createPostRequest, createRequiredParameter, createThymianFormat } from '@thymian/core-testing';
import { runRule } from '@thymian/rules-testing';

import createdResponsesHaveLocation from './created-responses-have-location.rule.js';

const format = createThymianFormat();
const launchesListed = addTransaction(format, createGetRequest({ path: '/launches' }), createOkResponse());
const launchCreated = addTransaction(format, createPostRequest({ path: '/launches' }), createCreatedResponse({ headers: { location: createRequiredParameter() } }));
// One operation with two answers is two transactions on the same request.
const createAstronaut = createPostRequest({ path: '/astronauts' });
const astronautCreated = addTransaction(format, createAstronaut, createCreatedResponse());
const astronautRejected = addTransaction(format, createAstronaut, createBadRequestResponse());

const run = runRule(createdResponsesHaveLocation);
const expected = [
  { location: { elementId: launchesListed }, status: 'notApplicable' },
  { location: { elementId: launchCreated }, status: 'passed' },
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
```

`runRule(rule)` gives one function per validation context, named as in the rule's `.type(...)`: `static` evaluates the rule with the context `thymian lint` uses, `test` with the one `thymian test` uses. Each returns the same list in the same order. Calling a context the rule does not declare throws.

### The server in `test`

`test` opens no port and sends nothing over the network. The tester builds each request from the format, with the examples the format carries, and the request is answered in-process.

**Without your saying anything, the server answers as the format declares:** the conforming response of a transaction has the declared status, every declared header (required or not) with a value, the declared media type as `content-type`, and a body where the response declares a schema. A value is the first example of its schema, else its `const`, first `enum` member or `default`, else the plainest value of its type. So a format gives the same result in `test` as in `static`.

**A server that deviates** is a function. It is given the id of the transaction the request is aimed at, the conforming response and the request that was sent, and returns the response:

```typescript
await run.test(format, {
  respond: ({ transaction, conforming }) => (transaction === launchCreated ? { ...conforming, headers: {} } : conforming),
});
```

Here `launchCreated` is `failed`: the server dropped the `Location` header the format declares. One condition can change many answers, for example `conforming.statusCode >= 400`. One operation with two answers gets two requests, one aimed at each transaction.

Two things make a transaction `skipped` in `test`, each with a `reason`, because the tester does not ask the rule about it:

- **The server answers another status than the transaction declares.** `thymian test` skips such a transaction too.
- **The request cannot be built**, for example for a path parameter without an example: give its schema one, `createRequiredParameter({ schema: createStringSchema({ examples: ['apollo-11'] }) })`.

### Any rule runs

**A rule that ships with severity `off`** runs like any other, so a rule that is only switched on by a config or a profile is testable as it ships. A `failed` execution carries the severity the rule declares, here `off`.

**A rule with options** gets them from `runRule(rule, { options })`, handed to the rule function as the `options` of the rule's entry in a config are. One call is one configuration:

```typescript
const format = createThymianFormat();
const launchCreated = addTransaction(format, createPostRequest({ path: '/launches' }), createCreatedResponse({ headers: { location: createRequiredParameter() } }));

expect(await runRule(createdResponsesHaveHeader, { options: { header: 'location' } }).static(format)).toMatchObject([{ location: { elementId: launchCreated }, status: 'passed' }]);
expect(await runRule(createdResponsesHaveHeader, { options: { header: 'etag' } }).static(format)).toMatchObject([{ location: { elementId: launchCreated }, status: 'failed' }]);
```

Options the rule's options schema does not accept make `runRule` throw, as a config with them is rejected when it is loaded.

### What comes back

A list of executions. Each one has:

| Field      | Meaning                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `location` | Where the engine located it. For a transaction: `{ elementType: 'edge', elementId: <transaction id>, label }`. A node location or a free string is passed through. |
| `status`   | `failed`, `passed`, `notApplicable` or `skipped`.                                                                                                                  |
| `message`  | When `failed`: the violation's message, or the rule's summary or description when it gives none.                                                                   |
| `severity` | When `failed`: the severity the rule declares.                                                                                                                     |
| `reason`   | When `skipped`: the reason the rule gave.                                                                                                                          |
| `findings` | What the rule attached to the execution, as a report carries it. Always a list; empty when the rule attached nothing.                                              |

The `label` is the readable name of the location, so a failing comparison says which transaction it is about although ids are hashes. A label the rule set itself is kept.

**Order.** Every transaction of the format, in the order it was added. A transaction the engine reported several executions on appears once per execution, in the order the engine reported them. Executions on any other location come last.

**Where `passed` and `notApplicable` come from.** In `test` the tester reports an execution for every transaction it sent a request for, `passed` and `skipped` included; `runRule` takes them as reported and adds only `notApplicable`, for a transaction no request was sent for. The linter reports only what a rule returns, which for most rules is its violations. In `static`, `runRule` works out the rest from the `appliesTo` the rule states in its rule-context calls: a transaction inside it that the engine reported nothing on is `passed`, one outside it is `notApplicable`. Several calls count together; a transaction is applicable when any of them accepts it.

A rule whose applicability cannot be read from outside, because it decides in a plain callback (`validateHttpTransactions` in `static`), passes only a violation condition, or makes no rule-context call at all, gets `passed` for every transaction it did not flag.

**Skips and findings.** A rule that returns a `rule-skip` finding for a location yields a `skipped` execution there, with the `reason` it gave. Any other finding comes back in `findings`, on a `passed` execution as much as on a `failed` one, in the shape of a report finding: `{ id, kind, title, message: { text } }`. The `id` is generated per run, so compare findings with `toMatchObject` or leave it out.

`notApplicable` is filled in for transactions only. A node or a free string appears only when the engine reports an execution on it.

<!-- FOOTER:START - Do not remove or modify this section -->

## 📚 Documentation

- **[Getting Started](https://thymian.dev/introduction/getting-started)** - Set up Thymian in minutes
- **[Documentation](https://thymian.dev)** - Comprehensive guides and API reference
- **[CLI Reference](https://thymian.dev/references/cli)** - Complete CLI command documentation
- **[HTTP Rules](https://thymian.dev/guides/http-rules/how-to-use-rules)** - Learn about HTTP conformance validation

## 🏢 Enterprise Support

Get professional consulting and dedicated support from the creators of Thymian. We offer:

- API design and governance strategies
- HTTP standards compliance auditing
- Custom plugin development
- Custom rule development
- Team training and workshops

**[Learn more about Enterprise Support](https://thymian.dev/enterprise)** | **Email: [support@thymian.dev](mailto:support@thymian.dev)**

---

<div align="center">

**Shipped with 🌱 by [qupaya](https://qupaya.com)**

</div>
<!-- FOOTER:END -->
