# ADR-0021: Adding a rule set: package per source, concern tags, and an executability gate

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-09-10 | —          | —             |

## Context

Two rule sets ship today: `rules-rfc-9110` (402 rules, built in RFC-section-sliced
batches) and `rules-api-description-validation`. The security surface of HTTP is not in
either of them, and it is not in one document — it is spread across RFC 9110 §17,
RFC 6797 (HSTS), RFC 6265bis (cookies), the WHATWG Fetch standard (CORS), CSP Level 3,
Referrer Policy, and RFC 7034 (`X-Frame-Options`). A survey of those sources found
**378 normative statements, 130 executable in at least one context, resolving to ~70–90
distinct rules**, about 25 of which already exist in `rules-rfc-9110` under a
non-security anchor.

Adding six packages by the existing conventions runs into four problems those conventions
do not answer.

**A partial rule set cannot say what it does not cover.** `rules-rfc-9110` ships 402 rules
and no statement of the denominator, so "Thymian supports CSP" is unfalsifiable at any
level of completeness. Security is exactly where that matters: a rule set covering a third
of CSP and saying nothing is worse than one that says so, because the reader takes silence
for coverage.

**`informational` is the path of least resistance.** 231 of the 402 RFC 9110 rules are
`informational` — they declare no validation context and run no rule function. That is
allowed by the builder and, at the time, by the only written authoring procedure. The
result is a rule set that reads as complete and asserts nothing over more than half its
surface. Nothing distinguishes "no check is possible here" from "no check was attempted".

**Security is a cross-cutting concern and the packages are not.** The 12 directories of
`rules-rfc-9110` are a _topic_ axis — methods, status codes, fields, caching. A security
concern cuts across all of them and across packages, so there is no way to name "the
security rules" at all. `meta.tags` exists on `RuleMeta` as `string[]` with **zero call
sites and zero consumers**.

**There is no usable route.** The `generate-rfc-rule` skill is the only written procedure
and it predates the `test` context, [ADR-0018](0018-recommended-rule-configuration-profiles.md)'s
profiles, and the current builder. It documents package paths that do not exist
(`packages/rfc-{n}-rules/`), omits `test` from the rule-type table, frames the types as a
cost ladder, maps RFC keywords to severities directly, and instructs authors to skip
`.rule()` for `informational` rules with no justification. An author following it produces
rules this ADR rejects.

One mechanism detail shapes the whole severity design. The default `ruleSeverity: 'error'`
floor filter loads only `error` rules, and the profile resolves _before_ that filter
(`applyRuleConfiguration` → `createSeverityRuleFilter`). Two of the new sources contain no
BCP 14 keywords in their relevant surface at all — the Fetch standard's CORS section has
zero — so a source-faithful `strict` profile would ship every one of Fetch's 26 CORS rules
at `warn` and then load **none of them**.

## Decision

We adopt one route for adding a rule set, resting on a single principle:

> **Package = provenance. Tag = concern. Profile = strictness. Coverage record = denominator.**

Each axis answers exactly one question, and no axis absorbs another. The four decisions
below are facets of that principle and are adopted together.

### 1. Package = provenance: one package per source document

Six packages join `rules-rfc-9110`, each named for the document it transcribes:

| Package                       | Source                            |
| ----------------------------- | --------------------------------- |
| `rules-rfc-6797`              | HTTP Strict Transport Security    |
| `rules-rfc-6265bis`           | Cookies                           |
| `rules-whatwg-fetch`          | Fetch (CORS)                      |
| `rules-w3c-csp`               | Content Security Policy Level 3   |
| `rules-w3c-referrer-policy`   | Referrer Policy                   |
| `rules-rfc-7034`              | `X-Frame-Options`                 |
| `rules-rfc-9110` _(existing)_ | HTTP Semantics, **including §17** |

The boundary is provenance and version cadence, not denominator size and not threat.
RFC 7034 and CSP's `frame-ancestors` both address clickjacking and do **not** merge into a
clickjacking package: grouping by threat is what a tag does. §17 stays in
`rules-rfc-9110`, where 27 of its rules already live.

- **Two package kinds.** _Spec_ packages transcribe an external document. _Self-referential_
  packages check an API against its own specification — `rules-api-description-validation`
  is the only one. The kind is documentation, not a field on `RuleSet`; only the
  conventions below that say "spec packages only" depend on it.
- **One slug in all three identifier places**: the npm specifier, the config-key prefix,
  and the rule-id prefix. `rules-api-description-validation`'s `thymian/` rule-id prefix is
  renamed to match.
- **No floor package and no aggregate package.** The thin packages carry real grammar and
  vocabulary conformance; a `rules-http-security` umbrella would group by concern, which is
  a tag.
- **`url` explains a rule; it does not prove provenance.** It stays optional on the type and
  is required by the route.
- **Convention rules** — an obligation no source imposes, over a mechanism a source defines
  (send HSTS at all, set `HttpOnly`, send a CSP) — live in the source's package. They ship
  `.severity('off')` with an executable `.type()`, which is what distinguishes them from an
  informational rule, so no new marker is needed.

### 2. Tag = concern: one closed axis, two levels

`meta.tags` becomes the concern axis and nothing else. `.tags()` is narrowed from
`(...tags: string[])` to a closed union; with zero call sites, the narrowing breaks nothing.

- **The first level is `security` and `privacy`, and that is all of it.** The directories
  already carry the orthogonal topic axis, and neither axis can absorb the other. The
  ~318 RFC 9110 rules that carry no concern stay **untagged by design**.
- **The second level is closed at 14 + 3 members**, admitted by a **disjointness test**: a
  member may name a _threat_ where its rules are near-disjoint (`cache-poisoning`,
  `request-smuggling`, `clickjacking`, `csrf`, `spoofing`), and must name a _mechanism_
  where the threat spans several. `security:xss` fails that test — see §5.
- **Exactly two levels.** A category's internal structure — CSP directives, CORS
  sub-concerns — belongs in the **rule name**, never in the tag namespace. The accepted
  cost is that "only my CSP `script-src` rules" is not a sliceable set.
- **Matching is segment-prefix and pattern-side**: `tag === pattern || tag.startsWith(pattern + ':')`.
  A _pattern_ may be partial; a _rule's_ tag must be fully qualified and terminal. This is
  what would make a third level additive later rather than breaking, and it is why a bare
  category is illegal **on a rule**: a CORS rule tagged bare `security` would be invisible
  to a `security:cors` pattern, which is the quieter failure.
- **The vocabulary is core-owned**, in `packages/core/src/rules/rule-tags.ts`, and declared
  twice on purpose — categorised for structure, flat for a compile error that lists the
  legal tags — held in lockstep by `satisfies`. Third parties open a PR, or use the
  documented `x-vendor:…` namespace.
- **Untagged stays legal.** It is policed by a warn-level workspace ESLint rule in
  `tools/eslint-rules/`, whose `eslint-disable` comment _is_ the "considered, nothing fits"
  marker. Acceptance for the RFC 9110 sweep is therefore `tagged + suppressed === 402` in
  CI, not a predicted suppression count.
- **`reliability` and `performance` are recorded as the expansion path, not shipped.**
  Adding a category is a free union widening.

The RFC 9110 retro-tag sweep lands in the same wave, because an incomplete slice ships a
confidently wrong answer. A census of all 402 descriptions puts it at **84 tagged /
318 untagged**, and **46 of the 84 are `informational`** — the concern axis is uncorrelated
with observability, which is why the sweep's denominator is all 402 rules and not the
executable subset. The sweep is **not mechanical**: the best honest keyword prefilter
reaches 75% recall on that census, and its misses are one cluster, because RFC 9110 writes
message framing in the vocabulary of framing rather than of smuggling.

### 3. Profile = strictness: all three, and promotion is gated

Every rule-set package ships all three [ADR-0018](0018-recommended-rule-configuration-profiles.md)
profiles.

- **`strict` = source fidelity.** For a source with no BCP 14 keywords, fidelity has a
  **`warn` ceiling** rather than an invented `error`.
- **`recommended` = conventions on, plus promotions gated on a concern tag _and_
  non-heuristic status.** A tag therefore changes which rules run with no filter in
  existence.
- **`minimal` = `error` + non-heuristic + exactly-observable**, and it is **derived from
  `coverage.ts`, never transcribed** — one expression instead of 402 entries that drift.
  Today `minimal` is literally an alias for `recommended` while 86 of the 174 `error` rules
  are `informational`; that retrofit lands with the sweep.
- **The promotion's reason lives in `explanation`**, which is already writable and already
  rendered by `thymian explain rule`. `.recommendation()` has no builder method and the
  `RECOMMENDATION` section is unreachable code; wiring it is an additive expansion path,
  deliberately not in this wave. The cost is that we cannot _mechanically_ test that a
  promotion states its reason; the tag-plus-non-heuristic half stays testable.

### 4. The executability gate

**Executability is mandatory and `informational` is a last resort.** Every normative
statement is evaluated in every context, and the three rule types are **lifecycle stages,
not a cost ladder**: `static` asserts at design time against the `Thymian Format`, `test`
at integration time against live endpoints, `analytics` at production time against recorded
traffic. Declaring several is what detects drift, so an author never stops at the first
context that happens to work.

Each statement gets a **per-context verdict**: _observable_, _heuristically observable_, or
_impossible with a named reason_.

- **Heuristic assertions are legal, never at `error`, and declared per context.**
  Heuristic-ness attaches to an assertion _in a context_ — the same assertion can be exact
  in `static` and a guess in `analytics`. It rides at `warn`/`hint`, and §3's promotion
  gate is what keeps it there: a heuristic rule is **never promotable**, whatever concern
  tag it carries. That is the only claim this section makes about profiles — `recommended`
  is not a leniency rung below `strict`, and may run a tagged, exactly-observable `SHOULD`
  at `error` where `strict` holds it at the source's `warn`. Barring heuristics would have
  cost 30 of the 130 executable statements and forced them into `informational`, which the
  first sentence of this section forbids.
- **Impossibility reasons are a closed vocabulary in two tiers.** Tier 1 makes a rule
  informational and lives in the rule file; tier 2 excludes one context and lives in
  `coverage.ts`.

  | Tier  | Code                        | Claim                                                                |
  | ----- | --------------------------- | -------------------------------------------------------------------- |
  | 1     | `only-origin-knows`         | Only the origin knows the fact the statement is about                |
  | 1     | `peer-not-observable`       | The obligation is on a peer whose internals are not observable       |
  | 1     | `nothing-to-check`          | No HTTP message can conform to it or violate it                      |
  | 1 & 2 | `tool-limitation`           | _Thymian_ cannot do this yet — **must cite a tracker issue**         |
  | 2     | `participant-not-reachable` | Thymian occupies the role, or cannot be positioned in it             |
  | 2     | `condition-not-producible`  | The participant is reachable, the situation is not                   |
  | 2     | `requires-controlled-input` | Recorded traffic cannot say whether the condition _should_ have held |
  | 2     | `not-representable`         | The artifact does not carry the shape the assertion needs            |

  A BCP 14 `MAY` is **not** a tier-1 reason. A `MAY` is checkable at `hint` — the finding is
  "the protocol offers this mechanism and it is not being used", which claims no
  non-conformance — so it goes `informational` only under the same world-claims as any other
  rule. `nothing-to-check` is a statement of fact, a definition, or a requirement addressed to
  a specification's author rather than to a message. _(Amended 2026-09-18; see Status History.)_

  Tier 1 reasons are claims about the **world** that no release can falsify. Tier 2 reasons
  are claims about **one context**. `tool-limitation` is deliberately the only code in both
  tiers, because the distinction it draws — us versus the world — is orthogonal to the
  distinction between one context and all of them. Requiring it to cite an issue is what
  stops a one-layer-deep gap being recorded as permanent.

- **The invariant: a rule is `informational` if and only if it declares no context.** That
  is the only place a tier-1 reason may appear, and the reason becomes an argument to
  `.type()`: `.type('informational', reason, note)`. An unreasoned `informational` is a
  compile error.
- **A declared context claims _demonstrated_, not conceivable.** Proof is **one fixture per
  declared context, new rule sets only** — `rules-rfc-9110` has 10 test files for 402 rules
  and is grandfathered. `rules-rfc-6797` proves the bar first at N=14.
- **`value-not-pinned-in-description` is not an impossibility reason.** A package's
  `coverage.ts` ships inside the package and cannot see the user's specification, so a
  document-dependent verdict would make the README lie for half its readers. It is a
  **runtime skip** instead, emitting `rule-skip` with a reason.
- **Robustness probes are permitted behind an explicit per-target switch that is off by
  default**, scoped by reuse of `skipOrigins`. Once on there is no method restriction —
  `thymian test` already replays state-changing traffic unconditionally, so restricting
  probes by method would be stricter than the rule already applied to ordinary test
  traffic. The surviving constraint is **payload shape**: a probe must be a well-formed
  message the spec permits, which keeps path traversal, injection, and credential stuffing
  out on their own merits. Consent is **its own axis, not a profile level**. A probing rule
  declares itself and its coverage record renders what it sends, because a consent gate is
  worthless if the operator cannot see what consenting admits. Declining a probe never
  yields `informational`; the rule emits `rule-skip`.

The gate's enforcement is **three complementary lanes**: the type system for tier 1,
`coverage.ts --check` for tier 2 (the only lane that can see an _omitted_ context), and a
per-package meta-test for the fixture bar, on the precedent of `profiles.test.ts`.

### 5. Coverage record = denominator

Every **spec** package carries a typed `coverage.ts`; self-referential packages carry none
of this.

- **The artifact is the typed file; the README is its rendering.** "Roadmap" is neither: the
  gap is _computed_ as `units` minus the union of every rule's `covers`.
- **Five sections, generated between markers inside `README.md`** — Coverage headline,
  Severity map, Conventions, Rule verdicts, Tag status. Inside `README.md` because
  `"files": ["dist"]` means npm force-includes only `README.md`, and a coverage claim has to
  ship with the version that makes it. The unversioned docs site may mirror it and may never
  become a second source of truth.
- **The record is authored per rule, not per unit.** A rule's entry carries what it `covers`,
  a declared-type-and-severity stamp, and cells only for the contexts it does _not_ declare —
  a declared context defaults to `observable`; the only value ever written for one is
  `heuristic`. There is no `.covers()` on the rule builder: what a rule discharges is a
  second, driftable claim if restated on the rule itself, so it is declared exactly once,
  here.
- **The numerator is derived, not asserted.** Rules and source units are N:M _both ways_ —
  all 14 rules on `#name-expect` discharge one unit. Each rule's entry declares `covers`, and
  the headline renders **two numbers** ("9 of 14 statements, covered by 21 rules") rather
  than one dishonest ratio. `.url()` was rejected as that mapping: 400 of 402 rules carry
  one, resolving to 105 anchor strings across three conventions — and its anchor belongs to
  the same document the rule set's own `url` names, one source document cited at one host
  (thymian#419 made this a build fact after `rules-rfc-9110` drifted under the silence once).
- **The denominator is a declared artifact**: n, the counting rule, the source revision,
  whether the source has a keyword basis (`hasKeywordBasis`, declared rather than parsed out
  of the counting rule's own prose — no regex over text written for a human reader can be
  trusted for the citation-requirement assertion), and a substitute label where the document
  has no enumerable unit. **Counted from the document, never from the rules that have been
  written** — a denominator derived from a package's own anchors makes coverage 100% by
  construction, the one number this whole convention exists to keep honest. A source with no
  denominator never refuses a package; an **undeclared counting rule does**. Denominators
  genuinely differ — Cookies splits producer from consumer itself (N≈24), Fetch's CORS
  surface has zero BCP 14 keywords, and RFC 9110 §17 has none either, so its substitute is
  the 14–15 sections it cross-references.
- **Verdict tables are profile-independent** — observability does not vary by profile, only
  severity does — and render one collapsed table per topic directory.
- **The convention table generates in full** from `severity === 'off' && !informational`,
  rendering `explanation` verbatim: the no-normative-basis reason and the promotion reason
  are one sentence, not two.
- **Uncovered units are rendered content, never a check.** The package's own meta-test is
  the gate — eight assertions, all of which fail the build; the generator's `--check` runs
  the same checker for a maintainer working locally and for the one release-time assertion.
  The load-bearing assertion is the **declared-type stamp**, which is what makes a _stale_
  reason detectable rather than only a missing row.

### 6. Ruled out, and why

- **External catalogs are not tags, and this effort ships no catalog manifest.** OWASP API
  Top 10 and its like map N:M onto rules across packages, and a wholly uncovered catalog
  item must stay visible — which metadata on a nonexistent rule cannot express. A catalog is
  not a rule set and ships no rules, so it sits outside this ADR entirely.
- **`security:xss` is a naming gap, not a coverage gap.** It fails the disjointness test and
  has no manifest to fall back on, so it gets two prose homes instead: a **documented
  recipe** — XSS posture is the union `security:csp` + `security:content-type` +
  `security:cookies` — and a per-rule `explanation`. The principled reason is provenance:
  across every in-scope source **exactly one normative statement names XSS** (CSP3 §6, a
  `SHOULD`). The Strict CSP recipe is explicitly non-normative; `nosniff`'s only
  server-addressed `MUST` constrains the header's ABNF, not an obligation to send it;
  nothing tells a server to set cookie `HttpOnly`; and `X-XSS-Protection` has no provenance
  at all and is removed from every major browser. A `security:xss` tag would be Thymian's
  own invention.
- **An awareness document does not get a rule written against a standards-track `MUST`.**
  OWASP API8-P5 advises disabling `HEAD`; RFC 9110 §9.1 requires every general-purpose
  server to support it. RFC 9110 wins, and the conflict is recorded rather than adjudicated
  per rule.
- **The `--tag` filter surface is deferred.** Running a security slice on its own is
  plumbing rather than rules, and its design is the densest single decision in the effort.
  It is deferred whole and unretracted, along with the global `tags?` config key and the
  `createRuleFilter`/`createSeverityRuleFilter` consolidation it needed. Two consequences
  belong here rather than in the deferral: the `security:xss` union recipe above is
  **documentation, not a runnable slice**, and rule-id-prefix tag attribution is not a
  dependency of this wave.
- **RFC 9112 is not a source.** `security:request-smuggling` is admitted on the disjointness
  test and is the largest tag in the corpus at 21 RFC 9110 rules, but the canonical
  `Content-Length` + `Transfer-Encoding` rejection is RFC 9112 §6.3. Whether RFC 9112 joins
  is a question this route _answers_ rather than one it waits on: adding it later widens the
  source list and is walked by the same skill.

## Consequences

**Positive:**

- A partially-implemented rule set ships honestly. The gap is computed from a declared
  denominator, so "we cover a third of CSP" is a build-checked claim rather than a silence
  the reader misreads.
- `informational` stops being free. It requires a world-reason from a closed vocabulary,
  refused at the type level if absent, and a declared context now claims a fixture rather
  than an intention.
- A security concern is nameable across packages, and a tag already changes which rules run
  through profile promotion — without any filter shipping.
- Each axis answers one question, so questions that used to have several plausible homes
  (does a clickjacking package exist? does caching get a tag?) have one derivable answer.
- The route is executable rather than described: the skill is the procedure, and the
  conventions above are enforced by the compiler, by `--check`, by ESLint, and by
  per-package meta-tests rather than by review.

**Negative:**

- The tag narrowing and the `.type()` reason argument touch **231 of the 402** existing
  RFC 9110 rules, and only 47 of 402 declare all three contexts today. That is a large,
  low-risk, unavoidable diff.
- Two levels of tag mean a category's internals are not sliceable. "Only my CSP
  `script-src` checks" cannot be expressed, by design.
- The security slice cannot be _run_ on its own in this wave. Early detection and drift
  detection arrive through profiles; the union recipe for XSS is prose.
- We cannot mechanically test that a promotion states its reason, because `explanation`
  carries it and `.recommendation()` is unwired.
- The fixture bar is grandfathered for `rules-rfc-9110`, so the corpus that most needs it
  is the one that does not have it.
- `coverage.ts` cannot be _populated_ until the impossibility vocabulary lands, which
  serialises part of the first wave.

**Neutral:**

- Every narrowing is free at the type level: `.tags(` has zero call sites and `meta.tags`
  zero consumers.
- Auditing the 231 existing `informational` rules against this gate is a separate effort.
  This ADR defines the standard they will be audited against; 230 of the 231 already carry a
  prose justification written under the older norm.
- Non-security coverage of the six new sources is out of scope. The packages ship their
  security slice and their coverage records say so.
- Two prerequisites are cited rather than owned: the `test`-context status-code gate
  (`run()` defaults `checkStatusCode: true`, which skips the case before the assertion runs
  for 69 of the 78 `test`-declaring RFC 9110 rules) and the `createRuleFilter` duplication.
  Both are code changes outside a decision about how to add a rule set. The per-step escape
  hatch — `run({ checkStatusCode: false })` — is already used by shipped rules.

## Related

- [ADR-0008](0008-package-naming-conventions.md): the `rules-*` naming this extends with
  one-slug-in-three-places and the spec/self-referential kinds.
- [ADR-0009](0009-rule-system-as-core-concern.md): the core-owned rule system that owns the
  tag vocabulary and the impossibility vocabulary.
- [ADR-0018](0018-recommended-rule-configuration-profiles.md): the `profiles` mechanism this
  makes mandatory per package and gates on a concern tag.
- [ADR-0014](0014-rule-results-carry-violations-and-findings.md): the `RuleFnResult` shape a
  rule's assertion returns in every context.
- [ADR-0007](0007-core-owns-validation-entrypoints-plugins-own-execution.md): the
  core/plugin boundary the coverage generator and the ESLint lane sit outside.
- [Chapter 8](../08-crosscutting-concepts.md): rule contexts and the plugin lifecycle the
  three rule types execute in.
- `.github/skills/add-http-rule-set/SKILL.md`: the executable route, and the skill to invoke
  for the work. It **supersedes `generate-rfc-rule` and `extract-rules-from-rfc-chapter`**,
  which contradict this ADR on the points listed under Context. Those two files still carry
  their original descriptions, so redirecting them is follow-on work; until it lands,
  `AGENTS.md` is what points an agent at the right one.
- `CONTEXT.md`: this ADR defines `Source`, `Source Unit`, `Denominator`, `Coverage Record`,
  `Rule Tag`, `Impossibility Reason` and `Convention Rule` for its own use. They land in the
  project glossary with the implementation, not with this record.

---

## Status History

| Date       | Status   | Notes                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-10 | Accepted | Route for adding an HTTP rule set one slice at a time; `--tag` filter and catalogs deferred                                                                                                                                                                                                                                                                                          |
| 2026-09-18 | Amended  | §4: a BCP 14 `MAY` is checkable at `hint` and is never `nothing-to-check`; `nothing-to-check` narrowed to statements of fact, definitions, and requirements on specification authors                                                                                                                                                                                                 |
| 2026-09-22 | Amended  | §5: corrected to the shipped shape — the record is authored per rule (no `.covers()` on the builder), a declared context defaults to `observable`, the denominator is counted from the document and never from a package's own rules, `.url()`'s anchor belongs to the document the rule set's own `url` names, and the package's own meta-test — not a bare `--check` — is the gate |
