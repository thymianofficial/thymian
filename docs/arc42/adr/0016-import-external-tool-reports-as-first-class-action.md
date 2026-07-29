# ADR-0016: External tool reports are imported via a first-class `import` action

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Proposed | 2026-07-29 | —          | —             |

## Context

Ticket [thymian-internal#357](https://github.com/thymianofficial/thymian-internal/issues/357)
asks for `@thymian/plugin-spectral`: a plugin that consumes pre-generated
Spectral output and surfaces its findings through Thymian's canonical report
model. Spectral is the first case of a general capability — importing results
produced by an **external tool** — so the integration pattern deserves an
architectural decision rather than an ad-hoc plugin design.

The forces at play:

- **An external report is not a validation subject.** Thymian's existing
  inputs — captured traffic (HAR) and API descriptions (OpenAPI) — are *facts*
  that Thymian's own rules judge via the `analyze`/`lint`/`test` contexts. A
  Spectral report is already a *judgment*: a set of findings about an API
  description. There is nothing for the rule engine to execute against it.
- **An external report cannot be interpreted standalone.** Spectral findings
  reference file/line positions inside an OpenAPI document. To integrate them
  into the unified report — where locations are `thymianFormat` graph
  references resolved against the serialized format
  ([ADR-0013](0013-thymian-format-must-not-contain-circular-references.md)) —
  the API description itself must be loaded first. Importing therefore
  *depends on* the loaded API description, further distinguishing the report
  from being an input "like" an API description.
- **The report model already anticipates external tools.** `Report.runs` is a
  list of `ToolRun`s, each carrying a `Tool { name, version }`, optional
  `Invocation`s ("external command/process invocations that contributed to
  this run"), `RuleDescriptor`s, and executions with findings
  (`packages/core/src/report/report.ts`). Thymian's severity vocabulary
  (`error | warn | info | hint`) is word-for-word Spectral's ruleset severity
  vocabulary (`HumanReadableDiagnosticSeverity`) — though Spectral's JSON
  *output* serializes these severities numerically (`0` = `error` …
  `3` = `hint`), so importing involves a real, if trivial, translation step.
- **Core owns validation entrypoints; plugins own execution**
  ([ADR-0007](0007-core-owns-validation-entrypoints-plugins-own-execution.md),
  [ADR-0009](0009-rule-system-as-core-concern.md),
  [ADR-0010](0010-core-owned-infrastructure-actions.md)). The three existing
  workflow kinds are core actions (`core.lint`, `core.test`, `core.analyze`,
  plus `core.workflow.*`) with the uniform shape
  `Action<{ …, format: SerializedThymianFormat }, ToolRun[]>`.
- **Per-plugin input already has a canonical CLI mechanism.** The `-o` /
  `--option` flag passes namespaced overrides to a plugin's configuration
  using the Helm `--set` convention:
  `-o @thymian/plugin-reporter.formatters.markdown.path=./report.md`
  (`packages/common-cli/src/flags/option-flag.ts`). No new input mechanism is
  needed to hand a report path to an importer plugin.

The question this ADR resolves: **do we treat external reports like traffic or
API descriptions (a loaded input source), or as something else — and through
which mechanism does an external report enter Thymian?**

## Decision

We will introduce **`import` as a fourth workflow kind**, next to `lint`,
`test`, and `analyze`. Importing an external report is an *execution* that
translates external results into the canonical report model — not the loading
of a new input source.

Concretely:

1. **New core actions `core.import` and `core.workflow.import`**, symmetric
   with the existing three kinds (naming per
   [ADR-0011](0011-action-naming-conventions.md)). The input includes the
   serialized Thymian format of the loaded API description — the same
   `CoreValidationInput`-based shape as `core.lint` — because imported
   findings are mapped onto the format graph. The result is `ToolRun[]`.
   **A loadable API description is required**: import keeps the exact input
   shape of the other three kinds (one mode, one contract). A format-less
   import (file-location-only, no loaded description) is deliberately out of
   scope; it would make the format input optional and force every downstream
   consumer to handle unanchored import runs. Revisit only if a concrete user
   need appears.
2. **A new report arm `runType: 'import'` with `ImportExecution`.**
   `ImportExecution` starts shape-identical to `LintExecution` (mirroring the
   `AnalyzeExecution` precedent: distinct type now so the shapes may diverge
   without a breaking change later). An imported run is thereby always
   distinguishable from a run Thymian executed itself.
3. **Importer plugins own the translation.** `@thymian/plugin-spectral` is the
   first importer. It supports exactly one payload format: **Spectral's JSON
   output** (other Spectral output formats are out of scope for this plugin).
   It parses/validates the payload and maps severity, rule identifier
   (`RuleDescriptor`), message, and location into the report model. Severity
   arrives as Spectral's numeric `DiagnosticSeverity` (`0`–`3`) and is mapped
   back to the shared word vocabulary; an out-of-range or missing severity
   value counts as an unsupported payload. A **malformed or unsupported
   payload becomes a failed import run in the report** — a `ToolRun` whose
   failed execution carries the parse error — so a combined run keeps its
   other results while still failing per Decision 7 (contrast the *missing*
   report file, a configuration error: Decision 4). Locations resolve to
   `thymianFormat` references (the loc-mapper approach already used by
   `@thymian/plugin-openapi`): each finding anchors to the loaded API
   description whose source file matches the finding's source path; findings
   referencing files outside every loaded description fall back to `file`
   locations. A report in which **no** finding matches any loaded description
   is treated as an unsupported payload — that is a stale or mismatched
   report, not a fallback case.
4. **The report path is plugin configuration, passed via the existing
   `--option` mechanism** — e.g.
   `-o @thymian/plugin-spectral.report=./spectral-report.json` — or the
   equivalent entry in the Thymian configuration file. No new CLI parameter
   style is introduced. A configured report path that does not exist is a
   clear **configuration error** in every entry point, including the combined
   workflow — configuring a report asserts that findings are expected.
   Pipelines in which the report only sometimes exists should pass the path
   per invocation via `-o` instead of committing it to the config file.
5. **Which importer runs is explicit configuration, not detection —
   configured = selected.** Mechanically, an importer plugin registers an
   import action under its own namespace (per
   [ADR-0011](0011-action-naming-conventions.md), following the existing
   `openapi.document` / `openapi.transform` pattern), and `core.import` fans
   out to every registered import action. The namespaced report-path option
   (Decision 4) already names the plugin explicitly —
   `-o @thymian/plugin-spectral.report=…` *is* the selection — so no
   additional `--type` parameter or `import.plugin` config key is introduced
   (either would be a second source of truth that can drift from the
   per-plugin config). Thymian never sniffs a payload to guess the producing
   tool. An importer plugin that is installed but has no report configured is
   skipped by the combined workflow; `thymian import` with zero configured
   importers is a clear error. Multiple importers configured side by side
   each contribute their own `ToolRun`.
6. **Provenance:** `ToolRun.tool` names the *external* tool (`spectral`, with
   its version when the report carries one), not the importer plugin. The
   source report file is recorded on the run (artifact/invocation metadata) so
   findings trace back to their origin.
7. **Outcome classification is uniform.** Every imported Spectral result is a
   rule violation and therefore maps to a `failed` execution carrying its
   mapped severity — the same `failed` ≡ violation semantics native rules
   have ([ADR-0014](0014-rule-results-carry-violations-and-findings.md)).
   Failed imported executions classify exactly like native failed executions
   ([ADR-0015](0015-cli-exit-status-is-severity-independent.md)): importing a
   non-empty report fails the run, independent of finding severities.
8. **`import` participates in the combined workflow (`thymian validate` /
   `core.workflow.*`) whenever an importer is configured** — consistent with
   Decision 5: configuration *is* the opt-in. Whoever configures a Spectral
   report wants those findings in the unified report; no additional
   enablement flag exists. With no importer configured, the combined workflow
   is unchanged, so existing setups see no difference. The per-kind commands
   (`thymian lint` / `test` / `analyze`) are likewise unaffected by importer
   configuration — only `thymian import` and the combined workflow run
   importers. `thymian import` itself takes the same spec-loading flags as
   `lint` (the loaded API description is a required input per Decision 1) and
   runs only the import kind.

### Alternatives considered

**A. Treat the external report as an input source, loaded like traffic or an
API description (shared "loader" mechanism).**
Rejected as a category error. Traffic and API descriptions are validation
subjects consumed by rule contexts; loading them produces material for rules
to judge. An external report is a finished judgment — modelling it as a
source implies rules could run "on" it and gives it a pipeline position it
does not occupy. It would also leave the API-description dependency implicit:
the report is only interpretable *against* a loaded format. (A related idea —
a generalized context-prefix addressing scheme such as `spectral:report.json`,
cf. thymian-internal#157 — changes how CLI input parameters work globally and
is explicitly out of scope here; it can be revisited independently without
affecting this decision.)

**B. Reuse the `lint` run type — the importer contributes a `ToolRun` with
`runType: 'lint'` and `tool: spectral` during `core.lint`.**
Rejected. It conflates "Thymian executed these rules" with "an external tool
vouches for these results": formatters, the WS event API, and downstream
consumers could no longer distinguish native from imported results without
heuristics on `tool.name`. It also entangles CLI semantics — `thymian lint`
would silently import external data — and Spectral's rule descriptors would
pollute the namespace of rules Thymian actually loaded.

**C. Merge at the formatter/reporting layer (post-processing).**
Rejected. Findings merged after report assembly never enter the canonical
model, so every downstream consumer (JSON formatter, WS events, the IntelliJ
plugin, future dashboards) would need its own merge logic — exactly the
fragmentation the unified-base report model removed.

**D. Auto-detect the report type from the payload shape.**
Rejected in favour of explicit plugin/type selection (Decision 5). Detection
fails ambiguously on overlapping JSON shapes and violates the requirement
that unsupported payloads produce *clear* errors. Explicit configuration also
keeps the door open for multiple importers side by side.

**E. Per-tool dedicated CLI flags (e.g. `--spectral-report=…`).**
Rejected. It scales linearly in flags per importer and duplicates what the
namespaced `--option` mechanism already provides.

## Consequences

**Positive:**

- Imported results live in the canonical report model; all existing and
  future formatters, events, and consumers see them without special cases.
- Clean provenance: `runType: 'import'` + `tool` make external origin
  first-class, satisfying traceability requirements.
- The importer category is reusable: a future generic importer (e.g. SARIF)
  or other tool-specific importers slot into the same action without further
  architectural work.
- Full symmetry with existing kinds keeps core's mental model small: four
  actions, one input/output shape.

**Negative:**

- The `ToolRun`/execution unions widen to a fourth arm: report schema, JSON
  formatter, markdown rendering, WS event API, and the IntelliJ plugin must
  all handle `import` runs (mostly mechanical, but touches many packages).
- A new CLI command (`thymian import`) and workflow action must be built,
  documented, and covered by e2e tests — more surface than a "just a plugin"
  reading of #357 suggests.
- Requiring a loaded API description (Decision 1) means importing a Spectral
  report about a spec Thymian cannot load (unsupported version, unresolvable
  refs) fails even though the external findings themselves are readable. This
  is accepted: a file-location-only fallback mode would make the format input
  optional and burden every downstream consumer with unanchored runs. To be
  revisited only on concrete user need.
- `import` is a reserved word in JavaScript/TypeScript: it works in every
  string/data position (action ids, `runType`, the CLI command), but bare code
  identifiers must use `importReport`-style names where the language forbids
  the word — a known, accepted wrinkle in the otherwise full symmetry.

**Neutral:**

- Spectral execution stays entirely outside Thymian (non-goal in #357);
  `Invocation` metadata can describe it when known, but Thymian never runs it.
- Severity mapping is trivial today (shared word vocabulary, numeric wire
  format) but becomes a documented mapping contract for future importers whose
  vocabularies differ.
- Spectral's own CLI fails only on `error`-severity results by default; under
  ADR-0015 a Thymian import of a Spectral-"passing" report that still contains
  findings fails the run. This is the intended severity-independent semantics,
  stated openly rather than discovered in CI.
- A future generic SARIF importer would also ingest Spectral-emitted SARIF,
  giving the same data a second, deliberate entry path whose `tool` provenance
  then comes from the SARIF payload rather than from `@thymian/plugin-spectral`.

## Related

- [ADR-0007](0007-core-owns-validation-entrypoints-plugins-own-execution.md):
  `core.import` follows the same ownership split — core owns the entrypoint,
  the importer plugin owns the translation work.
- [ADR-0009](0009-rule-system-as-core-concern.md): the rule system whose
  native executions imported runs sit alongside.
- [ADR-0010](0010-core-owned-infrastructure-actions.md) /
  [ADR-0011](0011-action-naming-conventions.md): action placement and naming.
- [ADR-0013](0013-thymian-format-must-not-contain-circular-references.md):
  the serialized format that imported findings anchor to.
- [ADR-0014](0014-rule-results-carry-violations-and-findings.md): execution
  status/finding model imported runs must populate.
- [ADR-0015](0015-cli-exit-status-is-severity-independent.md): outcome
  classification applied uniformly to imported executions.
- [thymian-internal#357](https://github.com/thymianofficial/thymian-internal/issues/357):
  motivating ticket (`@thymian/plugin-spectral`).

---

## Status History

| Date       | Status   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-28 | Proposed | Initial draft                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-07-29 | Proposed | Review: 3 open points resolved — format anchoring required (Decision 1); configured = selected, no extra selection parameter (Decision 5); workflow participation when configured (Decision 8)                                                                                                                                                                                                                                                                                  |
| 2026-07-29 | Proposed | Adversarial review: 12 findings resolved — numeric severity wire format + strict mapping, multi-spec anchoring with mismatch-as-unsupported-payload, malformed payload = failed run in report (D3); missing report file = configuration error (D4); importer action fan-out contract (D5); uniform violation→failed mapping (D7); sibling-command semantics (D8); JSON-only format scope + SARIF-overlap and fail-severity notes; reserved-word note; ADR-0009 added to Related |
