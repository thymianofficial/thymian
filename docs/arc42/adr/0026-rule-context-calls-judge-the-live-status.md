# ADR-0026: Rule-context calls judge the response the server actually sent

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Proposed | 2026-11-18 | —          | —             |

## Context

In `Test`, `runRequests` defaults `checkStatusCode: true`. When the live status code differs
from the one the specification declares for the transaction a test case was built from, the
case is **skipped**, and the rule-context validation methods drop every case that did not
pass. The rule's `Violation Condition` is therefore never evaluated on the transactions where
the implementation diverges from the specification — the population a `Test` rule exists to
catch. Across `rules-rfc-9110`, 69 of the 78 `test`-declaring rules ran behind this gate.
`general-purpose-servers-must-support-get-and-head` could only fire when the specification
itself documented the `501` it forbids. A grouped call was worse: one mismatching
transaction skipped the whole group, so a group keyed by origin was in practice always
skipped.

The default was introduced as a data-quality guard against badly generated test data. It
also served, by accident, as the only thing keeping a rule for 405 responses away from a
live 204 — until [ADR-0025](0025-applicability-and-violation-condition.md) made the rule
contexts ask `appliesTo` again of the pair that came back. ADR-0025 recorded the gate as a
separate under-reporting problem whose relaxation would rely on that re-check.

The guard is still right wherever the caller compares the live response against the
_declared_ one: `sampler check` (whose `skipped` Outcome on a mismatch depends on it), the
`checkBody`/`checkHeaders` schema-conformance rules, and test-builder pipelines whose
`forTransactionsWith` selects by declared status. Those pipelines ask applicability of the
specification only; dropping the gate under them would judge a 500 against a rule about 401
responses.

## Decision

We will drop the status-code gate only where a live applicability check replaces it.

- **The operator default stays.** `runRequests` keeps `checkStatusCode: true`. Callers that
  compare against the declared response keep the guard without changing a line.
- **The named-form rule-context calls opt out.** `validateCommonHttpTransactions`,
  `validateHttpTransactions` and `validateGroupedCommonHttpTransactions`, called with
  `{ appliesTo, violatedWhen }`, run their requests with `checkStatusCode: false` and rely
  on the live re-check of `appliesTo` (ADR-0025) to decide which pairs reach
  `violatedWhen`. In the grouped call, the re-check is per transaction.
- **The positional form keeps the gate.** It has no live re-check, so a mismatching pair
  would reach the validation function unchecked. Removing the positional overloads, as
  ADR-0025 intended, is a separate change (thymian-workspace#779).
- **A pair the live re-check rejects is `skipped`, not `passed`.** It surfaces as a
  `rule-skip` whose reason names the declared and the live status ("the description
  declares 401, the server answered 200"). The exit code is unaffected
  ([ADR-0015](0015-cli-exit-status-is-severity-independent.md) counts only `failed`). A
  grouped call judges the transactions that pass the re-check and says nothing about the
  rest; the group is `skipped` only when none of them does.
- **A status mismatch on a judged pair is reported, not gating.** When the live status
  differs from the declared one but the pair is still applicable and judged, the execution
  carries an `informational` status-drift finding. It neither skips nor fails the
  execution, and no rule reports it as a violation. Only the named-form context calls emit
  it: they know the pair was judged, while the operator cannot tell drift from a status a
  replayed request asked for.
- **Test-builder overrides decide the gate explicitly, by what they assert.**
  - An override whose selection does not depend on the declared status, and which asserts
    only on the live response, passes `checkStatusCode: false`.
  - A replay that expects a status other than the one declared for its transaction — a
    `304`, a `412`, a `303`, a `4xx` — passes `checkStatusCode: false` on the replayed step.
    Under the default it was skipped exactly when the server behaved correctly, so the rule
    could fail or skip but never pass. The seeding step keeps the gate, or a `skipIf`,
    because it must produce the declared response the replay is built from.
  - An override that selects by declared status and asserts about that status passes
    `checkStatusCode: false` and states the applicability on the live response with
    `skipIf(not(statusCode(…)), reason)`, so its skip reads like the context calls' skip.
  - An override that compares against the declared response — `checkBody`, `checkHeaders`,
    `expectStatusCode` — keeps the default.
- **The option is documented.** The rule-authoring guide states these four cases next to
  its override examples.

## Consequences

**Positive:**

- Rules whose applicability does not hinge on the declared status are judged on the
  responses where the server and the specification disagree.
- A grouped rule is no longer skipped wholesale by one undescribed status.
- A transaction the rule did not judge says why, instead of reading as `passed` or as a
  bare status mismatch.
- `sampler check`, `thymian request` and the schema-conformance rules keep their behaviour.

**Negative:**

- Reports change: executions that were `skipped` become `passed` or `failed`, and newly
  judged pairs can surface violations that were hidden before.
- The gate's meaning now depends on the call form. Positional `Test` calls — every `test`
  path of `rules-rfc-6265bis` and `rules-rfc-6797` — stay gated until they are converted
  (thymian-workspace#779).
- Every test-builder override remains a place a rule author must decide the gate
  explicitly; the default does not do it for them.

**Neutral:**

- `checkStatusCode` stays a public `run()` option and becomes a documented one.
- A rule matching zero transactions (thymian-workspace#780), and the report model
  collapsing a `failed` test case into `skipped` (thymian-workspace#781), are separate
  problems this decision does not touch.

## Related

- [ADR-0025](0025-applicability-and-violation-condition.md): the live re-check of
  `appliesTo` this decision relies on.
- [ADR-0015](0015-cli-exit-status-is-severity-independent.md): why a `skipped` execution
  does not change the exit code.
- [ADR-0024](0024-a-per-transaction-problem-must-not-end-the-run.md): `sampler check`'s
  four Outcomes, whose `skipped` on a status mismatch keeps the operator default.
- [ADR-0021](0021-http-security-rule-sets.md): cited the gate as an open prerequisite;
  amended to point here.
- [Chapter 8](../08-crosscutting-concepts.md): rule contexts.

---

## Status History

| Date       | Status   | Notes         |
| ---------- | -------- | ------------- |
| 2026-11-18 | Proposed | Initial draft |
