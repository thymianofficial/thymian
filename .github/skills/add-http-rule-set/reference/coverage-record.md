# The coverage record

Reference for steps 2 and 7 of [`../SKILL.md`](../SKILL.md). Rationale in
[ADR-0021 §5](../../../../docs/arc42/adr/0021-http-security-rule-sets.md). Shipped in
`@thymian/core`: the type and authoring helper (`rule-coverage.ts`), the checker
(`rule-coverage-checker.ts`), and the renderer (`rule-coverage-renderer.ts`) — this reference
describes what's actually there, not a plan for it.

**Spec packages only.** A self-referential package — one that checks an API against its own
specification, like `rules-api-description-validation` — carries none of this, because it
has no external document to be partial against.

The artifact is the typed file. The README is its **rendering**, and the gap is **computed**,
never written: `units` minus the union of every rule's `covers`. Nothing here is a roadmap;
a roadmap states intent, and this states the present.

## `src/coverage.ts`

Authored **per rule, not per unit** — the only shape that can carry the declared-type stamp,
which is what makes a stale reason detectable rather than only a missing row.

```ts
import { defineCoverage } from '@thymian/core';

export default defineCoverage({
  source: {
    revision: 'RFC 6797 (December 2012)',
    countingRule: 'One unit per BCP 14 keyword addressed to a server or a UA.',
    hasKeywordBasis: true, // declared, not derived from countingRule's own prose
    // substituteLabel: '…', // only where the document has no enumerable unit
  },
  units: {
    '§6.1': 'The Strict-Transport-Security header field…',
    // …
  },
  rules: {
    'rfc6797/hsts-host-must-not-send-sts-over-http': {
      covers: ['§6.1'],
      declared: { types: ['static', 'test', 'analytics'], severity: 'error' },
      // No `contexts` needed: every context this rule declares defaults to
      // observable, and it declares all three.
    },
    'rfc6797/sts-max-age-must-be-a-non-negative-integer': {
      covers: ['§6.1', '§6.1.1'], // one rule, two units
      declared: { types: ['test', 'analytics'], severity: 'error' },
      contexts: {
        // A cell exists only for a context this entry does NOT declare
        // (`static`, here) — explaining why, with a reason from the tier-2
        // vocabulary — or to mark a *declared* context 'heuristic', the one
        // value that overrides the observable default.
        static: { verdict: 'impossible', reason: 'not-representable', note: '…' },
      },
    },
  },
});
```

There is no `.covers()` on the rule builder. What a rule discharges is declared exactly once,
here — never restated on the rule itself as a second, driftable claim.

`countingRule` and `hasKeywordBasis` are the two fields a package cannot omit. A **missing
denominator never refuses** — some documents have none, and Fetch's CORS surface has zero
BCP 14 keywords — but an undeclared counting rule does, because it is the difference between
"this source cannot be counted" and "nobody tried". `hasKeywordBasis` is declared rather than
parsed out of `countingRule`'s prose: a real keyword-based source can describe its counting
rule without the word "keyword" at all, and a keyword-less source's prose can still mention
the word while explaining why it doesn't apply — no regex over text written for a human reader
can be trusted for the checker's citation-requirement assertion.

`substituteLabel` names what stands in where units are not statements: for RFC 9110 §17, the
14–15 sections it cross-references.

## The numerator is derived

Rules and units are **N:M both ways**. All 14 rules on RFC 9110's `#name-expect` discharge
one unit; one rule can discharge several. Each rule's entry declares `covers`, and the
headline renders **two numbers**:

> 9 of 14 statements, covered by 21 rules

not one ratio, which would be dishonest in whichever direction the N:M skews.

`.url()` is not that mapping and was rejected as one: 400 of `rules-rfc-9110`'s 402 rules
carry a URL, resolving to 105 anchor strings across three conventions. A URL says where a
rule is **explained** — and its anchor belongs to the **same document** the rule set's own
`url` names, so one source document is cited at one host (`rules-rfc-9110` drifted under
exactly this silence once; thymian#419 normalised it and made the invariant a build fact).

## The five README sections

Generated between markers **inside `README.md`**, in this order, by `renderCoverage`
(`rule-coverage-renderer.ts`) — a pure function with no file access; the generator script
(below) is what writes its output between the markers. Inside `README.md` because
`"files": ["dist"]` means npm force-includes only that file, and a coverage claim has to ship
with the version that makes it. The `HEADER`/`FOOTER` markers already in every package README
are the precedent.

1. **Coverage headline** — the two numbers, the counting rule, the pinned revision, the
   substitute label where there is one.
2. **Severity map** — per-profile counts.
3. **Conventions** — generated in full from `severity === 'off' && !informational`, rendering
   each rule's `explanation` verbatim. The no-normative-basis reason and the promotion reason
   are **one sentence**, not two. Probing rules render what they send here.
4. **Rule verdicts** — one collapsed table per topic directory. **Profile-independent**:
   observability does not vary by profile, only severity does, so this renders once. An
   informational rule's row is derived from its whole-rule reason (`rule.meta.impossibility`),
   never from the record.
5. **Tag status** — every concern tag in the closed vocabulary, every time: filled with a rule
   count, or named as shipped empty. A category the package's rules never touch at all still
   names its tags as empty, rather than going unmentioned.

**Uncovered units are rendered content, never a check.** A package is allowed to be partial;
it is not allowed to be quiet about it.

The docs site may mirror this and may never become a second source of truth: the site is
unversioned and deployed from `main`, so it can only ever describe `main`.

## The generator and `--check`

`nx run <pkg>:generate-coverage` (writes) and `nx run <pkg>:check-coverage` (`--check`:
reports and exits non-zero, writes nothing) — a workspace script
(`scripts/generate-coverage.ts`) that imports the built package, on the `generate-schema-docs`
precedent. It Prettier-formats the rendered block with the repo's own config before ever
writing it, so `format:check` cannot go red on freshly generated output.

**The package's own meta-test is the gate**, not `--check` — it calls `checkCoverage`
(`rule-coverage-checker.ts`) directly, on the `src/profiles.test.ts` precedent, and fails the
build on any of its eight assertions. `--check` runs the same checker for a maintainer working
locally, and is what the one release-time assertion in `scripts/release.ts` runs before
publish. All three call the one checker; none reimplements it.

The load-bearing assertion is the **declared-type stamp** — the entry names the rule types
and severity it was written against, which is what makes a _stale_ verdict detectable rather
than only a missing row. Without it, a rule that quietly drops a context leaves a reason
behind that still reads as current.

Split of responsibility, which is why both lanes exist:

- **TypeScript** (`defineCoverage`) checks the record is internally consistent — every
  `covers` id a real unit, every reason from the vocabulary, a `tool-limitation` cell citing
  an issue — at _author_ time.
- **The checker** checks the record agrees with reality — the rules that exist, the contexts
  they declare, the tags they carry — at _load_ time, from a package's built `dist`. It is the
  only lane that can see an **omitted** context, which is the failure the gate most needs
  caught.

Prettier-stable output (assertion 6 of the original enforcement table) is discharged by the
generator's own formatting step, not by a second implementation in core — core has no
Prettier dependency and shouldn't gain one for this.

## Ordering

`coverage.ts` cannot be **populated** before step 3's verdict table exists; its shape does not
wait on anything — `defineCoverage`, the checker, and the renderer all ship in `@thymian/core`
today, so a walk can write against the real thing from the first rule file.
