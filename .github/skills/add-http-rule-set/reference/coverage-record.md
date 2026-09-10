# The coverage record

Reference for steps 2 and 7 of [`../SKILL.md`](../SKILL.md). Rationale in
[ADR-0021 §5](../../../../docs/arc42/adr/0021-http-security-rule-sets.md).

**Spec packages only.** A self-referential package — one that checks an API against its own
specification, like `rules-api-description-validation` — carries none of this, because it
has no external document to be partial against.

The artifact is the typed file. The README is its **rendering**, and the gap is **computed**,
never written: `units` minus the union of every rule's `covers`. Nothing here is a roadmap;
a roadmap states intent, and this states the present.

## `src/coverage.ts`

```ts
export default {
  source: {
    revision: 'RFC 6797 (December 2012)',
    countingRule: 'One unit per BCP 14 keyword addressed to a server or a UA.',
    substituteLabel: undefined, // set where the document has no enumerable unit
  },
  units: [
    { id: '§6.1', text: 'The Strict-Transport-Security header field…' },
    // …
  ],
  verdicts: {
    '§6.1': {
      static: { verdict: 'observable' },
      test: { verdict: 'observable' },
      analytics: { verdict: 'heuristic' },
    },
    '§8.3': {
      static: { verdict: 'impossible', reason: 'not-representable' },
      test: { verdict: 'impossible', reason: 'participant-not-reachable' },
      analytics: { verdict: 'observable' },
    },
  },
} satisfies CoverageRecord;
```

`countingRule` is the field that refuses a package when absent. A **missing denominator
never refuses** — some documents have none, and Fetch's CORS surface has zero BCP 14
keywords — but an undeclared counting rule does, because it is the difference between "this
source cannot be counted" and "nobody tried".

`substituteLabel` names what stands in where units are not statements: for RFC 9110 §17, the
14–15 sections it cross-references.

## The numerator is derived

Rules and units are **N:M both ways**. All 14 rules on RFC 9110's `#name-expect` discharge
one unit; one rule can discharge several. So each rule declares `.covers()`, and the headline
renders **two numbers**:

> 9 of 14 statements, covered by 21 rules

not one ratio, which would be dishonest in whichever direction the N:M skews.

`.url()` is not that mapping and was rejected as one: 400 of `rules-rfc-9110`'s 402 rules
carry a URL, resolving to 105 anchor strings across three conventions. A URL says where a
rule is **explained**.

## The five README sections

Generated between markers **inside `README.md`**, in this order. Inside `README.md` because
`"files": ["dist"]` means npm force-includes only that file, and a coverage claim has to ship
with the version that makes it. The `HEADER`/`FOOTER` markers already in every package README
are the precedent.

1. **Coverage headline** — the two numbers, the counting rule, the pinned revision.
2. **Severity map** — per-profile counts.
3. **Conventions** — generated in full from `severity === 'off' && !informational`, rendering
   each rule's `explanation` verbatim. The no-normative-basis reason and the promotion reason
   are **one sentence**, not two. Probing rules render what they send here.
4. **Rule verdicts** — one collapsed table per topic directory. **Profile-independent**:
   observability does not vary by profile, only severity does, so this renders once.
5. **Tag status** — which concern tags the package contributes to, including the ones it
   ships empty.

**Uncovered units are rendered content, never a check.** A package is allowed to be partial;
it is not allowed to be quiet about it.

The docs site may mirror this and may never become a second source of truth: the site is
unversioned and deployed from `main`, so it can only ever describe `main`.

## `--check`

Eight assertions, all of which fail the build. The load-bearing one is the **declared-type
stamp** — the record names the rule types it was written against, which is what makes a
_stale_ verdict detectable rather than only a missing row. Without it, a rule that quietly
drops a context leaves a reason behind that still reads as current.

Split of responsibility, which is why both lanes exist:

- **TypeScript** checks the record is internally consistent — every verdict cell present,
  every reason from the vocabulary, every `covers` id a real unit.
- **`--check`** checks the record agrees with reality — the rules that exist, the contexts
  they declare, the tags they carry. It is the only lane that can see an **omitted** context,
  which is the failure the gate most needs caught.

## Ordering

`coverage.ts` cannot be **populated** before step 3's verdict table exists. Its shape is
fixed, so the generator can be built against it at any point; the content waits.
