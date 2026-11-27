# ADR-0031: A hook's fail verdict is a violation in `Test`

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-11-27 | —          | —             |

## Context

`computeTestCaseStatus` (`packages/plugin-http-tester/src/index.ts`) makes an `Execution`
`failed` only when a rule reported a violation, and `httpTest` reports one only for a test case
that recorded an `assertion-failure`. A test case the pipeline marked `failed` with no assertion
failure was reported `skipped`, which never fails a run
([ADR-0015](0015-cli-exit-status-is-severity-independent.md)).

Two different things reach that path:

1. **A hook's verdict.** A hook answering `http-testing.beforeRequest` or
   `http-testing.afterResponse` returns `fail` (in the sampler: `utils.fail(message)`), and
   `runRequests` calls `ctx.fail` without recording anything else. A hook answering
   `http-testing.authorize` had its `fail` and `skip` dropped altogether, so the request was
   sent anyway, in `Test` and in `sampler check` alike.
2. **A defect in the rule or the framework.** A rule's `.transactions()` callback throws
   something other than an `AssertionError`, or `singleStepForTransaction` cannot resolve the
   previous step or the transaction.

The documentation says `utils.fail` means _it ran and the result is wrong_, and `sampler check`
reports it as a `failed` Outcome with a non-zero exit
([ADR-0024](0024-a-per-transaction-problem-must-not-end-the-run.md)). `thymian test` reported
the same verdict as `skipped` and exited `0`, so a failure the user declared explicitly passed
CI.

## Decision

We will report a hook's fail verdict as a `failed` `Execution` in `Test`. A defect in the rule or
the framework stays `skipped`, with its reason.

- **The signal is an existing result type.** In the `beforeRequest`, `authorize` and
  `afterResponse` branches, `runRequests` records the hook's `fail` as an `assertion-failure`
  carrying its message, the transaction and its step/transaction location, and then calls
  `ctx.fail`. The `authorize` branch now also honours `skip` and keeps the hook's test results,
  as the other two do. `httpTest` places it on the transaction's edge as it does any assertion
  failure, and `computeTestCaseStatus` returns `failed`. It falls back to the case's reason
  when the violation carries no message, so the hook's message (or a failed `expect`'s) is the
  `Execution`'s reason. "A test case is a
  violation exactly when an assertion failed" stays the only rule, and no public type in
  `@thymian/core` changes.
- **It lives in core, not the sampler**, because `fail` is part of the public
  `HttpTestHookReturnType`: every plugin that answers the hook actions gets the same behaviour.
- **A defect is not a violation.** Calling a bug in a rule `failed` would blame the API for it,
  and throwing would end the rule and hide its other test cases, which ADR-0024 rejected. It
  stays `skipped` until the report model has a status for "the tool broke".

### Considered Options

- **A new `HttpTestCaseResult` member, or a new field on `HttpTestCase`, marking who failed the
  case.** Rejected: both are public types in `@thymian/core`, and the result union is switched
  over exhaustively by its consumers, so every one of them would have to change for a signal an
  existing type already carries.
- **Treat a failed case without an assertion as `failed` by default, and have defects record an
  `execution-error`.** Rejected: any future `ctx.fail` caller that forgets the
  `execution-error` would silently turn a defect into a violation.
- **A distinct `errored` `ExecutionStatus` kind for defects.** Deferred: it changes the Report
  Format and ADR-0015's exit-code mapping, which is more than this fix should carry.

## Consequences

**Positive:**

- `utils.fail` means the same thing in `thymian test` and `sampler check`, and what the
  documentation says.
- `computeTestCaseStatus` and `httpTest` keep a single rule for `failed`.

**Negative:**

- **Exit-code change.** A `thymian test` run whose hooks call `utils.fail` exited `0` and now
  exits `1`. This must be in the release notes.
- **One verdict fails several executions.** A hook runs inside every rule's test case that sends
  its transaction, so one `fail` fails one `Execution` per such rule, each labelled at that
  rule's own severity although the rule itself found nothing.
- In the `Test` report the hook's message appears twice: as the status reason and as the
  assertion-failure finding. A failed top-level `expect` already shows it twice the same way.

**Neutral:**

- `sampler check` changes only for `authorize`: it already reports a failed test case as
  `failed` and does not print a detail that repeats the case's reason, but an `authorize`
  hook's `fail` now reaches it at all.
- A defect stays `skipped`. The report tells it apart from a deliberate skip only by its reason.

## Related

- [ADR-0015](0015-cli-exit-status-is-severity-independent.md): any `failed` execution fails
  the run; amended here.
- [ADR-0024](0024-a-per-transaction-problem-must-not-end-the-run.md): the sampler's
  `skipped`/`failed` line, which `Test` now follows for hook verdicts.
- `packages/core/src/http-testing/operators/run-requests.operator.ts`: where the verdict is
  recorded.
- `packages/plugin-http-tester/src/http-test-api-context.ts` (`httpTest`) and
  `packages/plugin-http-tester/src/index.ts` (`computeTestCaseStatus`).
- Ticket thymianofficial/thymian-workspace#781.

---

## Status History

| Date       | Status   | Notes                       |
| ---------- | -------- | --------------------------- |
| 2026-11-27 | Accepted | Initial draft (ticket #781) |
