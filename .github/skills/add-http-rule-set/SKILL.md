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

Step 0's cut decides the pull requests; the length of a session never does. Where one step
outgrows a session — a survey past ~25 units, a topic directory of many rules — split it at
a step boundary or along the source's own subsections, and hand over the artifact produced so
far, never mid-survey.

## Step 0 — Cut the walk into tickets

A walk that builds a package produces a denominator, a verdict table, rules, fixtures,
profiles, a coverage record and a paper trail: more than one review can read against one list
of acceptance criteria. It is **spec-sized**: one spec, cut into sub-issues, one pull request
each.

Assign it to the one person working it, then spec it with this skill's steps as the spec's
structure. The spec carries the decisions the tickets are cut from: the pinned revision and
the slug (step 1), the units and the counting rule (step 2), and the verdict table (step 3),
which names every rule and the contexts it declares.

Cut it into sub-issues at the step boundaries, in dependency order, each taking the done-whens
of the steps it builds as its acceptance criteria:

1. **Prefactor** — a change to shared code the walk needs, such as a helper moving into core,
   so the feature PRs carry only the walk's own change.
2. **Package and denominator** (steps 1–2, and step 7's meta-test on the empty package) —
   registered, with no rules yet, its README reading 0 of N and its meta-tests green, so
   every later rule lands under them.
3. **Rules, one sub-issue per topic directory** (steps 4–5, and step 7's entries for those
   rules) — the rules, their fixtures and their `coverage.ts` entries. The first batch brings
   the fixture harness.
4. **Profiles and the complete record** (steps 6–7) — every profile, the record at its exact
   census, the README regenerated.
5. **Paper trail** (step 8) — including whatever the walk found this skill silent or wrong on.

A **defect** met on the way, in core, a plugin or a script, is its own ticket, marked as
blocking the sub-issue that needs the fix, and fixed in its own pull request, which merges
ahead of the stack.

One pull request per sub-issue, each based on the one below it and merged bottom up.

**Done when** the spec's sub-issues exist, each carrying its acceptance criteria, and every
defect already known is a ticket blocking the sub-issue that needs it.

## Step 1 — Fix the provenance

Name the source document and pin its revision. One document, one package, on provenance and
version cadence.

Derive one slug and use it, character for character, in all three identifier places:

| Place                                   | Role                                                   |
| --------------------------------------- | ------------------------------------------------------ |
| npm specifier (`@thymian/rules-<slug>`) | the selector the user installs and names in `ruleSets` |
| rule-id prefix (`<slug>/<rule-name>`)   | namespaces config keys and profile entries             |
| `RuleSet.name`                          | display only                                           |

The rule holds where an older package's prefix predates it: `rules-rfc-9110`'s `rfc9110/`
stays as it is, and a new package follows the rule.

Copy the package scaffolding from `packages/rules-rfc-6797`, the first package built by this
route — `package.json`, `project.json`, `tsconfig*.json`, `vitest.config.ts`,
`eslint.config.mjs`, and `src/index.ts`'s `pattern: 'rules/**/*.rule.js'` glob. Unlike
`rules-rfc-9110`'s, its lib build and its dependency-checks lint leave out `*.fixtures.ts`
and `src/test/`, so nothing test-side ships or counts as a runtime dependency. `"files"`
stays as it is, shipping `dist` only; step 7 depends on it.

The scaffolding's checks are `nx build`, `nx run rules-<slug>:lint` and `nx test`. It has no
`typecheck` target (`addTypecheckTarget: false`), and `nx build` compiles only what ships:
type-check the tests, the fixtures and the harness with `tsc -p` on a throwaway config beside
`tsconfig.lib.json` that extends it with `"noEmit": true` and `"exclude": []`.

Then register the package everywhere the repository lists its packages: the commit scope in
`commitlint.config.js` and the scope table in `CONTRIBUTING.md`, `excludePackages` in
`.license-checker.json`, the root `tsconfig.json` references, and
`docs/arc42/05-building-block-view.md` — its container, its `implements` relation and its
package-table row. `npm install` links the workspace package; keep its lockfile change to
the new package's own entries.

Joining the CLI's defaults is a separate decision, because it changes what every run without
a config reports: a dependency of `packages/thymian`, an entry in `common-cli`'s
`default-config.ts` and in the config schema's `ruleSets` default, and a line in the built-in
rule sets of `docs/arc42/08-crosscutting-concepts.md`.

**Done when** the slug reads identically in all three places, the package is registered, and
`nx build rules-<slug>` succeeds on an empty rule directory.

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

**Done when** `nx build`, the package's lint and step 1's `tsc` pass, and every rule's
declared contexts match its row in step 3's table.

→ [`reference/concern-tags.md`](reference/concern-tags.md) for choosing a tag, adding a
member, and tagging a source that is not itself a security document.
→ [`reference/executability-gate.md`](reference/executability-gate.md#what-each-context-can-see)
for the common-versus-override triggers.

## Step 5 — Demonstrate every declared context

A declared context claims the assertion is **actually evaluated**, not conceivable. Write one
fixture per rule per declared context, and a package meta-test that asserts the bar, on the
precedent of `src/profiles.test.ts`.

A context is demonstrated through its **real engine**: the linter's, the tester's and the
analyzer's own `ApiContext`, driven by core's `runRules` the way each plugin drives it. A stub
context proves the rule function, and nothing about the context. `rules-rfc-6797`'s harness is
the shape to copy: `src/test/harness.ts` runs one rule in one context, with the three plugins
as devDependencies; each rule's `<name>.fixtures.ts` sits beside its rule file; and
`src/fixtures.test.ts` asserts the bar and runs every fixture.

Each context's fixture pairs an input the rule must **flag** with one it must **pass** — a
pass, not a skip — and, where the rule emits a runtime `rule-skip` for an input it cannot
decide, adds a third it must **skip**.

`test`-context fixtures need one guard: `run()` defaults `checkStatusCode: true`, which skips
the case before the assertion runs whenever the live status differs from the declared one.
Pass `run({ checkStatusCode: false })` on the step whose status you are deliberately changing —
`origin-server-should-send-400-for-unsupported-partial-put` shows the shape. Every such opt-out
gets a fixture whose server answers with a status the description does not declare, so the
suite goes red if the opt-out is ever lost.

**Done when** the meta-test passes with zero exemptions and `nx test rules-<slug>` is green.

## Step 6 — Ship all three profiles

Severity carries strictness, not the RFC keyword. Resolution runs shipped default → profile →
user config, and the `ruleSeverity: 'error'` floor filter runs **after** the profile.

- **`strict`** — source fidelity. For a source with no BCP 14 keywords, fidelity has a **`warn`
  ceiling**; inventing `error` there would be Thymian's opinion wearing the source's authority.
- **`recommended`** — convention rules on, plus promotions **gated on a concern tag and
  non-heuristic status**. State the promotion's reason in `explanation`.
- **`minimal`** — `error` + non-heuristic + exactly-observable, **derived from `coverage.ts`**
  by core's `deriveMinimalProfile`, never transcribed.

**Convention rules** — an obligation no source imposes, over a mechanism a source defines
(send HSTS at all, set `HttpOnly`) — ship `.severity('off')` with an executable `.type()`, and
`recommended` promotes them. The executable `.type()` is what distinguishes them from an
informational rule.

A convention rule **covers no unit**: its `coverage.ts` entry has `covers: []`. The unit it
resembles gets a rule of its own — a `MAY` its `hint`, a conditional `SHOULD` its heuristic —
so `strict` still checks what the source says. The checker does not enforce this, so assert
it in the package's coverage meta-test, as `rules-rfc-6797`'s does.

A requirement conditional on a choice no exchange shows — a `SHOULD` that binds only a host
that has opted in — is at best heuristic in every context, so it is never promoted. Its
**convention twin** asks the same of every server, exactly: it ships `off`, and `recommended`
turns the twin on and turns off the source's rule that reports the same wire fact — the
heuristic rule, or a `MAY`'s `hint` — so one response is reported once. `rules-rfc-6797`'s
`server-should-send-sts-header-over-secure-transport` and
`server-should-redirect-insecure-requests-to-https` are the shape.

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

The meta-tests and the generator read the **built** package, so `nx build` comes before
trusting either. A renamed or deleted rule lingers in `dist/` until `dist/` is removed —
`tsc` leaves the old `.rule.js` behind and the loader still finds it — and a build that
reports a cache hit right after a rule file was added may not have emitted it; rebuild with
`--skip-nx-cache`.

**Done when** the package's meta-test passes, `nx run <pkg>:check-coverage` reports no
violations, and regenerating the README produces no diff.

→ [`reference/coverage-record.md`](reference/coverage-record.md)

## Step 8 — Close the paper trail

- `CONTEXT-MAP.md` in the workspace: add the package to the `packages/rules-*` line.
- The package's own `CONTEXT.md`, only where the source introduces vocabulary the project
  glossary does not already carry.
- An ADR, only where this walk decided something ADR-0021 did not — a new tag category, a new
  impossibility reason, a source that changes the package boundary.
- This skill, wherever the walk found it silent or wrong: folded in as rules that hold for
  any source.

**Done when** the walk's record matches what shipped, and anything ADR-0021 did not anticipate
is written down where the next walk will find it.
