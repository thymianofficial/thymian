---
name: add-http-rule-set
description: Add a rule set for one HTTP source document, one security slice at a time. Use when adding a package for an RFC or W3C/WHATWG spec (HSTS, cookies, Fetch/CORS, CSP, Referrer Policy, X-Frame-Options), when extending an existing rule set with a source's security rules, when deciding a rule's contexts or its concern tag, or when a package's coverage record is wrong. Supersedes generate-rfc-rule and extract-rules-from-rfc-chapter.
---

# Add an HTTP rule set

One source document becomes one package, in one walk. The walk is ordered because each
step consumes the previous step's output: the **denominator** bounds the survey, the
survey's **verdicts** decide what each rule declares, and the declarations are what the
**coverage record** renders.

[ADR-0021](../../../docs/arc42/adr/0021-http-security-rule-sets.md) is why the route is
shaped this way. Read it once; do not re-derive it per rule.

The principle every step falls out of:

> **Package = provenance. Tag = concern. Profile = strictness. Coverage record = denominator.**

When a question has several plausible homes, that line answers it. A clickjacking package
groups by threat, so it is a tag. A caching tag groups by topic, so it is a directory.

## Scope one walk

One source document, its **security slice**, one package. A slice is not a subset you
choose for convenience: it is every security-related statement the source makes.

Order for the first walks, smallest real conformance clause first:
`rules-rfc-6797` (N=14) → `rules-rfc-6265bis` → `rules-whatwg-fetch` → `rules-w3c-csp` →
`rules-w3c-referrer-policy` → `rules-rfc-7034`. RFC 9110 §17 folds into the existing
`rules-rfc-9110`.

A source larger than ~25 units is more than one session. Split at a step boundary and hand
over the artifact that step produced, never mid-survey.

## Step 1 — Fix the provenance

Name the source document and pin its revision. One document, one package, on provenance and
version cadence.

Derive one slug and use it, character for character, in all three identifier places:

| Place                                   | Role                                                   |
| --------------------------------------- | ------------------------------------------------------ |
| npm specifier (`@thymian/rules-<slug>`) | the selector the user installs and names in `ruleSets` |
| rule-id prefix (`<slug>/<rule-name>`)   | namespaces config keys and profile entries             |
| `RuleSet.name`                          | display only                                           |

Copy the package scaffolding from `packages/rules-rfc-9110` — `package.json`, `project.json`,
`tsconfig*.json`, `vitest.config.ts`, `eslint.config.mjs`, and `src/index.ts`'s
`pattern: 'rules/**/*.rule.js'` glob. `"files": ["dist"]` stays as it is; step 7 depends on it.

**Done when** the slug reads identically in all three places and `nx build rules-<slug>`
succeeds on an empty rule directory.

## Step 2 — Declare the denominator

Before a single rule file. The denominator is what lets a partial package ship honestly, and
an **undeclared counting rule refuses the package** — a source with no enumerable unit does
not.

**Count from the document, never from the rules you have written.** A denominator derived
from your own rules' anchors makes coverage 100% by construction — the one number this whole
convention exists to keep honest. Read the source and enumerate its units before a rule file
exists; a unit count that moves every time a rule is added is the tell that it drifted.

**Prior research is a seed.** Where someone has already counted the source, start `units`
and `countingRule` from their counting rule and N, then re-count against the revision step 1
pinned. Research pins its own revision, and a draft or a living standard moves under it, so a
seeded count is re-counted, never copied.

Write `src/coverage.ts` with `units`, the `countingRule` prose, the source `revision`, and a
`substituteLabel` where the document has no enumerable unit. Populate the unit list; leave
the per-unit verdicts to step 3.

Denominators genuinely differ, so derive rather than assume: Cookies splits producer from
consumer itself (N≈24); Fetch's CORS surface contains **zero** BCP 14 keywords; RFC 9110 §17
has none either, so its substitute is the 14–15 sections it cross-references. A keyword count
is a counting rule; so is "one per author-facing directive". Either is fine, declared.

**Done when** `units` is complete against the pinned revision and `countingRule` states, in
one sentence, what made something a unit.

→ [`reference/coverage-record.md`](reference/coverage-record.md) for the file's shape.

## Step 3 — Run the executability gate

The step the rest of the walk rests on, and the one to spend the session's legwork in.
Where prior research has already judged the source's statements, **seed the verdict table
from it** and re-verify every seeded verdict against the pinned revision — a seeded verdict is
re-verified, never copied. Map its rows onto your `units`, and translate any verdict it states
in another vocabulary into this gate's codes; one with no equivalent code is a cell to judge
afresh.

For **every unit**, judge **every one of the three contexts** and record one verdict per cell:

- **observable** — the context can evaluate the assertion exactly
- **heuristically observable** — visible on the wire, but does not strictly imply
  non-conformance
- **impossible** — with a code from the closed vocabulary

The three types are **lifecycle stages, not a cost ladder**: `static` asserts at design time,
`test` at integration time, `analytics` at production time. They assert the same thing at
three altitudes, and declaring several is what detects **drift**. Judge all three even after
one of them works.

`informational` is the last resort, legal only where every context is impossible for a
**world** reason. Reaching for it early is the failure this step exists to prevent: 231 of
`rules-rfc-9110`'s 402 rules are informational, written before this gate existed.

**Done when** the verdict table is complete — every unit × three contexts, every seeded cell
re-verified against the pinned revision — every impossible cell carries a vocabulary code,
and every `tool-limitation` cites a tracker issue. Write the whole table before opening a
rule file.

→ [`reference/executability-gate.md`](reference/executability-gate.md) for the verdict
procedure, both reason tiers, and what each context can actually see.

## Step 4 — Write the rule files

One file per rule, `src/rules/<topic>/<name>.rule.ts`, default-exported, discovered by the
glob. Group by the source's own topic structure; a subsection earns a directory at ~5 rules.

Builder order is enforced by the types: `.severity()` → `.type()` → metadata → assertions →
`.done()`.

```ts
export default httpRule('<slug>/<actor>-<keyword>-<constraint>')
  .severity('warn')                       // strictness, not the RFC keyword — see step 6
  .type('static', 'test')                 // exactly the contexts step 3 cleared
  .tags('security:transport')             // concern, fully qualified and terminal
  .url('https://…#anchor')                // an anchor in the document RuleSet.url names
  .description('…')                       // the normative text
  .explanation('…')                       // why it matters; `thymian explain rule` renders it
  .appliesTo('origin server')
  .rule((ctx) => …)
  .done();
```

- `.type()` declares **exactly** the contexts step 3 cleared. Declaring one claims a fixture
  in step 5, so a context you cannot demonstrate does not go in.
- An informational rule carries its tier-1 reason in `.type()`:
  `.type('informational', reason, note)`. Unreasoned informational is a compile error.
- `.tags()` takes fully-qualified terminal tags. Untagged is legal where nothing fits, marked
  by the ESLint suppression comment, which _is_ the "considered, nothing fits" record.
- `.url()`'s anchor belongs to the **same document** the rule set's own `url` names — one
  source document, cited at one host. `rules-rfc-9110` drifted under exactly this silence (11
  of 400 citations at a second host for the same RFC; thymian#419 normalised it and made the
  invariant a build fact) before this line named the constraint.
- There is no `.covers()` on the builder. What a rule discharges is declared once, in
  `coverage.ts`'s own entry for it (step 7) — not restated here as a second, driftable claim.
  Rules and units are N:M both ways.
- Prefer `ctx.validateCommonHttpTransactions(condition, constraint)` where the assertion is
  the same in every declared context. Where the engine differs per context, use
  `.overrideStaticRule()` / `.overrideTest()` / `.overrideAnalyticsRule()` with helpers shared
  inside the same file. Both are single-source-of-truth; the rule **file** is the source of
  truth, not the common interface.

**Done when** `nx build`, `nx lint` and `nx typecheck` pass for the package, and every rule's
declared contexts match its row in step 3's table.

→ [`reference/concern-tags.md`](reference/concern-tags.md) for choosing a tag, adding a
member, and tagging a source that is not itself a security document.
→ [`reference/executability-gate.md`](reference/executability-gate.md#what-each-context-can-see)
for the common-versus-override triggers.

## Step 5 — Demonstrate every declared context

A declared context claims the assertion is **actually evaluated**, not conceivable. Write one
fixture per rule per declared context, and a package meta-test that asserts the bar, on the
precedent of `src/profiles.test.ts`.

`test`-context fixtures need one guard: `run()` defaults `checkStatusCode: true`, which skips
the case before the assertion runs whenever the live status differs from the declared one.
Pass `run({ checkStatusCode: false })` on the step whose status you are deliberately changing —
`origin-server-should-send-400-for-unsupported-partial-put` shows the shape.

**Done when** the meta-test passes with zero exemptions and `nx test rules-<slug>` is green.

## Step 6 — Ship all three profiles

Severity carries strictness, not the RFC keyword. Resolution runs shipped default → profile →
user config, and the `ruleSeverity: 'error'` floor filter runs **after** the profile.

- **`strict`** — source fidelity. For a source with no BCP 14 keywords, fidelity has a **`warn`
  ceiling**; inventing `error` there would be Thymian's opinion wearing the source's authority.
- **`recommended`** — convention rules on, plus promotions **gated on a concern tag and
  non-heuristic status**. State the promotion's reason in `explanation`.
- **`minimal`** — `error` + non-heuristic + exactly-observable, **derived from `coverage.ts`**
  rather than transcribed.

**Convention rules** — an obligation no source imposes, over a mechanism a source defines
(send HSTS at all, set `HttpOnly`) — ship `.severity('off')` with an executable `.type()`, and
`recommended` promotes them. The executable `.type()` is what distinguishes them from an
informational rule.

Check the floor-filter interaction before shipping: a package whose `strict` profile is all
`warn` loads **zero** rules under the default `ruleSeverity`.

**Done when** all three profiles exist, every profiled rule id resolves to a real rule, and
`minimal` is computed from `coverage.ts`.

## Step 7 — Render the coverage record

Fill in step 3's verdicts as `coverage.ts`'s per-rule entries, then generate the five README
sections between markers inside `README.md`.

**The package's own meta-test is the gate** — on the precedent of `src/profiles.test.ts`
(step 5), it calls `checkCoverage` directly and fails the build on any of the eight
assertions, the same way every other package invariant in this repo is enforced: in the test
suite, not by a separate CI step. `nx run <pkg>:generate-coverage` (writes) and
`nx run <pkg>:check-coverage` (`--check`: reports and exits non-zero, writes nothing) are the
**local and release-time lane** — what a maintainer runs by hand, and what the one
release-time assertion in `scripts/release.ts` runs before publish. Both call the same
checker the meta-test does; neither is a second implementation of it.

**Done when** the package's meta-test passes, `nx run <pkg>:check-coverage` reports no
violations, and regenerating the README produces no diff.

→ [`reference/coverage-record.md`](reference/coverage-record.md)

## Step 8 — Close the paper trail

- `CONTEXT-MAP.md` in the workspace: add the package to the `packages/rules-*` line.
- The package's own `CONTEXT.md`, only where the source introduces vocabulary the project
  glossary does not already carry.
- An ADR, only where this walk decided something ADR-0021 did not — a new tag category, a new
  impossibility reason, a source that changes the package boundary.

**Done when** the walk's record matches what shipped, and anything ADR-0021 did not anticipate
is written down where the next walk will find it.
