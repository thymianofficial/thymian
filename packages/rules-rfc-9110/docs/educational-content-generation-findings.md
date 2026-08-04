# RFC 9110 educational content — generation-approach findings

Issue #289 asked us to (a) add educational content to the rules in `@thymian/rules-rfc-9110`
and (b) evaluate whether that first-draft content can be **generated** at scale rather than
written entirely by hand. This document records the outcome of the generation experiment so it
can guide follow-up work.

## What was produced

An `.explanation(...)` was added to every rule that is surfaced to users — i.e. every rule whose
`.type(...)` includes at least one real execution context (`static`, `analytics`, or `test`).
Purely `informational` rules were deliberately left untouched, because the framework never
surfaces them to users, so educational text there would be dead weight.

| Group                                                                    | Count |
| ------------------------------------------------------------------------ | ----- |
| Total rules in the package                                               | 402   |
| Applicable rules (≥1 non-informational context) — **got an explanation** | 171   |
| Informational-only rules — **left unchanged**                            | 231   |

Each explanation is one short paragraph (~40–90 words) that (1) restates the rule in plain
language and (2) says why it matters in practice, grounded in the exact RFC 9110 section the rule
already links via `.url(...)`.

## The generation approach that was tested

1. **Enumerate and scope.** Programmatically split the 402 rules into the 171 applicable ones
   (skipping `informational`) and grouped them into 15 topic batches by directory locality.
2. **Fan out.** One generation agent per batch, run in parallel. Each agent received: the batch's
   rule files, the authoritative RFC text (`docs/rfc9110.txt`), and a strict instruction set —
   locate the linked RFC section, write plain-language + why-it-matters prose, add exactly one
   `.explanation(...)`, change nothing else, and follow the package's string/formatting
   conventions.
3. **Mechanical guardrails instead of trust.** The instructions pinned the invariants a machine
   can check afterwards: only `.explanation(...)` added, informational rules untouched, one
   explanation per file, grounded in the linked section.
4. **Verify in bulk.** After generation: assert 171/171 applicable rules changed and 0/231
   informational rules changed; assert the diff is purely additive (no pre-existing line
   touched); then `tsc --noEmit`, `prettier`, `eslint`, and the package test suite.

## Results

- **Coverage:** 171/171 applicable rules received exactly one explanation; 0 informational rules
  were touched. The change is purely additive (0 deletions across all 171 files).
- **Correctness of the mechanical result:** `tsc` clean, `prettier` clean (after the repo's
  normal format-on-write), `eslint` 0 errors (1 pre-existing unused-import warning, unrelated),
  105/105 package tests pass.
- **Content quality (reviewed sample):** grounded in the cited RFC section, accurate, and genuinely
  explanatory rather than a restatement of `.description`. Read-ready as a first draft. Examples:
  the 405 explanation correctly ties the mandatory `Allow` header to "tell the client what to try
  instead"; the Via explanation correctly frames the rule around loop detection and path tracing.

## Is generation viable? — Yes, with a light human review pass

**Can generated content produce a useful first draft?** Yes. The drafts are on-topic, faithful to
the RFC, and consistently structured (what + why).

**Accurate enough to review rather than write from scratch?** Yes — with a review pass that
actually checks faithfulness. Grounding each agent in the exact linked RFC section (not just the
rule's `.description`) kept the content anchored to the normative text. An adversarial review of
all 171 explanations against the RFC found **3 grounding defects** (≈1.8%), all in the _rationale_
rather than the requirement: one invented an obsolete accept-parameter grammar to explain why
`q` goes last (contradicting RFC 9110 §12.5.1); two others (`305` deprecation, `HEAD` no-body)
attached true-but-unsourced justifications not present in the cited section. All three were fixed
in this pass. No case was found where the _rule requirement itself_ was misstated. This is the
expected shape of the effort: the generated draft gets the "what" right and occasionally
over-reaches on the "why," which a fact-checking review catches cheaply.

**Does it reduce manual effort meaningfully?** Substantially. 171 explanations were produced in
one parallel pass. The remaining effort is editorial review, not authoring.

**Is quality consistent enough for the whole set?** Mostly — consistent in structure and accuracy.
The one systematic inconsistency to iron out in review is **narrative voice**: ~48 of 171
explanations address the reader in the second person ("your client must not…"), the rest use the
third person ("a client must not…"). Both read well in isolation; the mix is only noticeable when
browsing many rules. This is a style decision the team should make once and apply uniformly.

### Recommended follow-up

- **Pick one voice** (recommend third person, matching `.description`/`.summary`) and normalize the
  ~48 second-person explanations to match. This is the main refinement.
- **Editorial skim** for length outliers and any rule where the "why" leans on a cross-referenced
  RFC concept (e.g. cacheability, strong vs weak validators) to confirm the referenced definition
  is represented faithfully.
- **Bake the workflow in.** The batch-generate → assert-invariants → typecheck/lint/test pipeline
  used here is reusable for other rule packages (e.g. future RFC packages). The invariant checks
  (additive-only diff, per-context applicability, one-explanation-per-file) are what make an
  otherwise-large change safe to review quickly.

### Net recommendation

Generation is a practical, scalable workflow for this content. Treat the generated text as a
**review-ready first draft**: keep the machine-checked invariants as the safety net, and spend
human time on a single voice-normalization + accuracy skim rather than on authoring from scratch.
