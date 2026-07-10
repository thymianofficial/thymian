# ADR-0015: CLI exit status is severity-independent

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-07-07 | —          | —             |

## Context

Before the Report Format v4 rewrite (Story 4/5, #333/#334), the CLI's exit
code was decided by finding severity: `classifyReport`'s default predicate was
`finding.severity === 'error' || finding.severity === 'warn'`, so a `hint`- or
`info`-severity finding produced a clean exit (`0`) even though it was
reported. This let a CI pipeline configure `ruleSeverity: hint` for
low-priority rules and rely on them never failing the build.

Report Format v4 replaced finding-level severity with execution-level
**status** (`passed` | `failed` | `skipped` — see
[ADR-0014](0014-rule-results-carry-violations-and-findings.md)'s addendum).
Severity moved off findings entirely: it is now resolved per failed execution
from `status.severity` (an override) or the rule's configured severity via
`resolveExecutionSeverity` (`packages/core/src/report/finding-render.ts`), and
is a rendering concern, not a classification input.

When `packages/common-cli/src/workflow-outcome.ts` was rewritten to classify
by execution instead of by finding, its default `isFinding` predicate became
`execution.status.kind === 'failed'` — with no severity check at all. This was
flagged in PR #311 review (BaggersIO) as a **silent behavior change**: a
`hint`-severity rule violation now produces `status: { kind: 'failed',
severity: 'hint' }`, which is an exit-1 `findings` classification, where
pre-v4 it was a `hint` finding and exited `0`.

The question this ADR resolves: is that change intentional, and if so, why?

## Decision

We will classify the CLI outcome — and therefore the exit code — from
execution **status alone**, regardless of resolved severity:

```ts
// packages/common-cli/src/workflow-outcome.ts
const isFinding = options.isFinding ?? ((execution: Execution) => execution.status.kind === 'failed');
```

- **Any `failed` execution makes the run non-clean (exit `1`)**, independent of
  the severity that would be resolved for it. A test case (or lint/analyze
  execution) fails when a rule reports a violation — which happens on an
  `assertion-failure` or any other violation-triggering condition a rule
  chooses to raise (see `computeTestCaseStatus` in
  `packages/plugin-http-tester/src/index.ts` and `statusAndFindingsFromEntry`
  in `packages/core/src/report/report-builder.ts`) — not on severity.
- **Severity stays a purely presentational concern.** It controls how a
  failure is _labelled_ (`error`/`warn`/`hint`/`info`, resolved via
  `resolveExecutionSeverity`) in the markdown/CSV/CLI output, and it drives the
  `Summary: N error(s), N warning(s), N hint(s), N info(s)` breakdown — but it
  does not gate whether the run is considered clean.
- **`tool-error` is currently unreachable by default** (`isToolError = () =>
false`): there is no distinct "the tool itself couldn't run" signal in the
  v4 model, so every technical failure surfaces as a `failed` execution today.
  Callers may still opt in to a custom `isToolError`/`isFinding` predicate via
  `ReportClassificationOptions` (e.g. to restore severity-gating for a
  specific workflow) — the default is what's being decided here, not the only
  possible behavior.
- Rationale: a rule violation is something the user explicitly configured
  Thymian to check for. If a rule fires, the run did not pass that check,
  independent of how loudly the failure is labelled. Severity is a triage aid
  for humans reading the report, not a gate on whether CI should proceed.
  Reusing severity for both purposes was also the source of a related bug
  class — see [ADR-0014](0014-rule-results-carry-violations-and-findings.md)'s
  discussion of findings-on-pass being dropped when severity and outcome were
  conflated.

## Consequences

**Positive:**

- Classification has a single, simple rule ("any failed execution fails the
  run") that is easy to state and to test, and matches "a rule you configured
  fired" rather than requiring readers to also know the severity-to-exit-code
  mapping.
- Decouples the exit-code contract from the finding/severity model, so future
  severity scheme changes (e.g. #335's SARIF-style counting work) cannot
  silently change exit codes.

**Negative:**

- **Breaking change for CI pipelines** that set `ruleSeverity: hint` (or
  similar) on rules expecting them to never fail the build. Those pipelines
  now exit `1` on a hint violation where they previously exited `0`. This must
  be called out in the #334 release/migration notes.
- No default escape hatch exists without writing a custom `isFinding`
  predicate; there is no built-in `--fail-on-severity` style flag.

**Neutral:**

- `tool-error` (exit `2`) is unreachable through the default predicates today;
  it exists as an extension point for callers, not a currently-firing path.

## Related

- [ADR-0014](0014-rule-results-carry-violations-and-findings.md): the
  `RuleFnResult`/`ExecutionStatus` model this classification reads from.
- `packages/common-cli/src/workflow-outcome.ts`: `classifyReport`,
  `classificationToExitCode`, `handleWorkflowOutcome`.
- `packages/core/src/report/finding-render.ts`: `resolveExecutionSeverity` —
  where severity is resolved for _display_, independent of this decision.
- PR [thymianofficial/thymian#311](https://github.com/thymianofficial/thymian/pull/311)
  review discussion that raised this as a silent behavior change.

---

## Status History

| Date       | Status   | Notes                                                                  |
| ---------- | -------- | ---------------------------------------------------------------------- |
| 2026-07-07 | Accepted | Document severity-independent exit-code classification (Story 5, #334) |
