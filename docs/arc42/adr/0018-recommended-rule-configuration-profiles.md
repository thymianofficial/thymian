# ADR-0016: Recommended rule-configuration profiles on RuleSet

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-08-03 | —          | —             |

## Context

Rule packages (`@thymian/rules-*`) ship every rule at one fixed
severity/execution context. Adopting the curated, noise-tuned RFC 9110 set
(16 changes, tracked in #324) therefore meant hand-pasting a large `rules:`
block into the config — undiscoverable, verbose, and drift-prone (the source
analysis document even carried a rule-id typo). There was no composition
primitive for a package to ship a recommended configuration alongside its
rules.

The rule loader already resolves each rule's effective configuration in a
fixed order: a rule ships a default severity/type, and the user's `rules:{}`
config overrides it via `applyRuleConfiguration`
(`packages/core/src/rules/rule-loader.ts`), where a config value wins over the
shipped default (`severity ?? existing`, `type ?? existing`). The
`ruleSeverity` floor filter (`createSeverityRuleFilter` in
`packages/common-cli/src/merge-inputs.ts`) then evaluates the fully-resolved
severity. We wanted a curated middle layer between "shipped default" and "user
config" without disturbing either end of that order, and without touching the
internal `core.lint`/`core.test`/`core.analyze` detail-action `rules` payload
(the contract frozen by [ADR-0007](0007-core-owns-validation-entrypoints-plugins-own-execution.md)).

## Decision

A rule set's exported `RuleSet` object gains an optional `profiles` field: a
map of profile name to a `RulesConfiguration` (the exact same per-rule shape as
the config `rules:` block).

```ts
type RuleSet = {
  name: string;
  // …
  profiles?: Record<string, RulesConfiguration>;
};
```

- **Config selects a profile per rule set.** A `ruleSets` entry is now
  `string | { name, profile? }`. A bare string — or an object without
  `profile` — resolves to `recommended`. `recommended` is the default
  everywhere; opting into `strict` or `minimal` requires the object form. The
  schema (`thymian-config-schema.ts`/`.json`) validates `profile` against the
  enum `recommended | strict | minimal`.
- **Resolution order per rule:** shipped default → selected profile override →
  user `rules:{}` (the user always wins). The loader applies the profile map
  with the same merge as `applyRuleConfiguration`, then applies the user config
  on top. The `ruleSeverity` floor filter still runs afterwards on the
  fully-resolved severity — it was not moved into the merge.
- **Profiles are exception lists, scoped to their own rule set.** A profile
  lists only the rules that deviate from shipped defaults; unknown/unlisted
  rule ids are silently ignored, and a missing `profiles` map or unknown
  profile name resolves to an empty override (no throw). A profile can only
  ever touch rules belonging to the rule set that declares it, so composition
  across packages is safe by construction.
- **Additive threading, not a payload change.** The profile selection is
  carried into the workflow input as a parallel `ruleProfiles` map
  (specifier → profile name), threaded through `loadRules` down to
  `loadRuleSet`. The resolved `Rule[]` handed to the detail actions is
  unchanged in shape, so the ADR-0007 detail-action contract holds.
- **RFC 9110 ships the first instance.** `recommended` encodes the 16 tuning
  changes (12 rules to `off`, 2 narrowed from `static` to
  `analytics`/`test`, 2 demoted to `hint`); `strict` is empty (spec-faithful
  shipped defaults); `minimal` deliberately reuses the `recommended` map this
  round (a curated high-signal core is a tracked follow-up). A package test
  asserts every profiled rule id resolves to a real rule, guarding against the
  drift/typo that motivated this work.

## Consequences

**Positive:**

- Adopting a package's curated configuration is a one-liner (a bare `ruleSets`
  entry), and the recommended tuning is discoverable and versioned with the
  package rather than copy-pasted per project.
- The tuning lives entirely in the profile map: no rule file's shipped default
  severity/context changes, and no per-rule `recommended` flag is added to
  `RuleMeta`. `strict` recovers the exact spec-faithful behavior.
- Reuses the existing `applyRuleConfiguration` merge and the existing
  floor-filter placement, so there is one resolution code path to reason about.

**Negative:**

- Profile names are free-form strings on the `RuleSet` type; only the config
  schema constrains them to the three known names. A package could ship a
  profile the config schema cannot select without a schema change.
- `minimal` is currently identical to `recommended`, which is a deliberate
  stopgap that could mislead until the curated set lands.

**Neutral:**

- The `ruleProfiles` map is an additive optional field on the workflow input
  and the workflow action schemas; existing in-process and WS callers that do
  not send it get `recommended` by default.
- Profiles do not enforce completeness — an unlisted rule keeps its shipped
  default, by design.

## Related

- [ADR-0007](0007-core-owns-validation-entrypoints-plugins-own-execution.md):
  the detail-action contract the profile threading was kept additive to avoid.
- [ADR-0008](0008-package-naming-conventions.md): the `rules-*` package role
  that ships `profiles`.
- [ADR-0009](0009-rule-system-as-core-concern.md): the core-owned rule system
  the `RuleSet` type and loader belong to.
- `packages/common-cli/src/thymian-config-schema.json`: the `ruleSets` entry
  schema (`oneOf[string, object]`) that surfaces the profile selection. It is
  the single schema artifact; `thymian-config-schema.ts` re-exports it for
  consumers rather than restating it.

---

## Status History

| Date       | Status   | Notes                                                                                  |
| ---------- | -------- | -------------------------------------------------------------------------------------- |
| 2026-08-03 | Accepted | Introduce `profiles` on `RuleSet`; RFC 9110 `recommended` is the first instance (#467) |
