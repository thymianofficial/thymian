# ADR-0021: `report diff` emits a non-`Report` diff document and gates on diff changes

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-08-26 | —          | —             |

## Context

`thymian report diff` (thymian-internal#502) compares two persisted Thymian reports and reports what changed: run results that appeared or disappeared, specification endpoints that were added/removed/changed (detected over the embedded Thymian format graphs), and rules/rulesets that were reconfigured. Three placement questions had no precedent:

1. **Input loading.** [ADR-0016](0016-two-stage-report-actions.md) reserves a `core.report.<verb>` action per report verb, but warns that only genuinely cross-cutting verbs may be promoted; `report merge` (#507) already chose to reuse `core.report.convert` instead of minting `core.report.merge`. Diff additionally must NOT pool its two inputs into one assembly: the cross-input `runId` dedup that is correct for merge is exactly wrong for diff (a report diffed against a copy of itself would collapse; a copied-then-edited pair would throw).
2. **The output artifact.** Every existing output path (`core.report` event → `plugin-reporter` file formatters) is `Report`-shaped. A diff is not a `Report` — it has no runs, and forcing it into one would corrupt the model's meaning.
3. **The exit code.** [ADR-0015](0015-cli-exit-status-is-severity-independent.md) fixes report classification as severity-independent, and explicitly leaves consumers the `ReportClassificationOptions` escape hatch. A diff's pass/fail question ("did anything regress?") is about _changes between two reports_, not about either report's executions.

## Decision

1. **Inputs load through `core.report.convert`, once per side.** `Thymian.reportDiff({ base, head })` emits the existing convert collect action separately for each input, so the `thymian:` claim in `@thymian/plugin-reporter` serves both loads, claim enforcement and error wording are reused, and the two sides never share a `runId` dedup. No new core action is minted (`core.report.diff` stays reserved, per ADR-0016's restraint and the #507 precedent). Fragments gained an optional `report: { reportId, createdAt }` tag (set by the `thymian:` claim) so diff can attribute each side to exactly one source report; a multi-report file per side is rejected (merge first).
2. **The diff document is a deliberate sibling of `Report`, not a `Report`.** `ReportDiff` (`diffId`, `createdAt`, `baseReportId`/`headReportId`, `baseCreatedAt`/`headCreatedAt`, `changes[]`) lives in core next to the report model with its own loose Ajv schema (`reportDiffSchema`), follows the same conventions (camelCase, ISO dates, optional-over-null), and **never flows through `core.report`** — no formatter side effects, no report files written by a diff. The CLI prints a compact deterministic summary by default and the JSON document with `--json`; a markdown rendering is a follow-up story.
3. **`--fail-on` gates on diff changes, at the CLI layer — and the default is informational.** Default `none`: a diff never fails on its findings unless the caller opts in — a comparison run must not gate anything by accident (usage and tool errors still exit 2). `regression` fails (exit 1) on any _added run-result change_ regardless of severity, `error` only on added error-severity changes, `any-change` on any change at all; improvements, specification changes, and rule changes never fail outside `any-change` — which, as a pure change detector, is the one gate an improvements-only diff can fail (the summary then marks it as failing). Run-result identity is run type + tool name + rule id + paired location + failure details; identical same-tool duplicates collapse by design (set semantics). This does not touch ADR-0015: report-execution classification is unchanged; reading the _resolved severity of a diff change_ in the `error` mode is precisely the consumer-layer decision Epic 323's handoff assigns to callers.

## Consequences

**Positive:**

- Self-diff is exactly empty, and a copied-then-edited input pair diffs instead of erroring — per-side loading removes the shared-dedup hazard structurally.
- The claim path stays the single boundary for persisted-report reading; when the Thymian-only input restriction is lifted, foreign formats work through the same mechanism without a new contract.
- CI gets a stable machine artifact (`reportDiffSchema`) and an opt-in exit-code gate that cannot be tripped by improvements — and never fires unless the pipeline asked for it.

**Negative:**

- Two action emissions per diff instead of one (negligible: the claim is an in-process listener).
- The diff document is a second persisted schema to keep loosely-compatible over time.

**Neutral:**

- `ConvertedRunFragment.report` is additive and optional; foreign converters ignore it, `reportConvert()` ignores it.
- Report inputs are CLI-only per [ADR-0020](0020-report-inputs-are-cli-only-for-merge-and-diff.md); only `thymian:` inputs are accepted for now (the embedded format linkage is what endpoint comparison is built on) — enforced at the command boundary, not in the claim layer.

## Related

- [ADR-0015](0015-cli-exit-status-is-severity-independent.md): report classification stays severity-independent; the diff gate is a consumer-layer decision on a different subject
- [ADR-0016](0016-two-stage-report-actions.md): report-verb placement; `core.report.diff` intentionally not minted
- [ADR-0017](0017-typed-input-arguments.md): `--base`/`--head` reuse the typed-input syntax (shared `parseTypedInput`)
- [ADR-0020](0020-report-inputs-are-cli-only-for-merge-and-diff.md): CLI-only report inputs, inherited by diff

---

## Status History

| Date       | Status   | Notes                                                                                                                                   |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-26 | Accepted | Decided in thymian-internal#502 (story 502.1); review amendment same day: default `--fail-on` mode changed from `regression` to `none`. |
