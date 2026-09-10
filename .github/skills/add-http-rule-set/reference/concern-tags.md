# Concern tags

Reference for step 4 of [`../SKILL.md`](../SKILL.md). Rationale in
[ADR-0021 §2](../../../../docs/arc42/adr/0021-http-security-rule-sets.md).

`packages/core/src/rules/rule-tags.ts` is the vocabulary. It is core-owned and closed, so a
typo is a compile error rather than a filter that silently matches nothing. Read the members
there; what follows is how to choose among them.

## The axis

Tags carry **concern** and nothing else. The first level is `security` and `privacy` — that
is the whole of it. Topic already has an axis: the directory tree. Neither absorbs the
other, which is why most rules in a general-purpose source carry **no tag at all**: 318 of
`rules-rfc-9110`'s 402, by design.

**Two levels, always.** A category's internal structure — CSP directives, CORS
sub-concerns — belongs in the **rule name**. `security:csp` is the tag; `script-src` is part
of the name.

A rule's tag is **fully qualified and terminal**. A bare category on a rule is illegal, and
the reason is worth carrying: matching is segment-prefix on the pattern side, so a CORS rule
tagged bare `security` would be **invisible** to a `security:cors` pattern. That is the
quieter of the two failures.

## Choosing a member

**Does an existing member fit?** Use it. Adding a category is a free union widening, so the
bar for adding is taxonomy, not effort.

**Does nothing fit?** Add a member — that is the designed response, not a reason to force a
bad fit. It passes the **disjointness test**:

> A member may name a **threat** where its rules are near-disjoint from every other member's.
> It must name a **mechanism** where the threat spans several members.

`cache-poisoning`, `request-smuggling`, `clickjacking`, `csrf` and `spoofing` earn threat
names on that test. `xss` fails it — its rules are spread across CSP, content-type and
cookies — so XSS is expressed as the **union** `security:csp` + `security:content-type` +
`security:cookies` and named in each rule's `explanation`. There is no `security:xss` tag,
and the provenance argument is the stronger one: across every in-scope source, exactly one
normative statement names XSS.

**Does the concern not exist yet?** `reliability` and `performance` are the recorded
expansion path at the first level. Widening to them is a decision, so it is an ADR, not a
tag edit.

## Nothing fits

Untagged is legal. Mark it with the ESLint suppression comment — the suppression **is** the
"considered, nothing fits" record, and `tagged + suppressed === <total>` is what CI checks.
A silently untagged rule and a judged-untaggable one are indistinguishable without it.

Genuine untagged cases in the corpus: lost-update hazards, retry duplication, protocol
downgrade, misrouting. They are evidence for the `reliability` path rather than a gap.

## Tagging a general-purpose source

Three policies, where a source is not itself a security document:

1. **A permissive statement gets no tag** — unless the permission _is_ the mitigation, or
   the hazard. The MIME-sniffing permission is the one where the permission is the hazard.
2. **Tag the mechanism's whole surface**, not only the statements that mention the concern.
   All six `#name-referer` rules carry `privacy:referrer`, whether or not the text says
   "privacy".
3. **Framing integrity gets `security:request-smuggling` even where the source's text is
   silent about smuggling.** A source writes message framing in the vocabulary of framing.
   Reversing this policy drops RFC 9110's total from 84 tags to ~63.

Policy 3 is the only one whose tags need a per-rule `//` reason, because they cannot be
defended by quoting the rule's own description. Every other tag is defended by the
vocabulary plus the disjointness test.

**Do not prefilter mechanically.** The best honest keyword filter reaches 75% recall against
a full census, and its misses cluster: two rules asserting the identical `MUST NOT` land on
opposite sides of it purely by how much surrounding prose the author transcribed. Rule ids
are no help either — they encode the actor, not the concern. Read every description. The
sharpest false positives are security words inside **exception clauses**.

An empty category is a legitimate state, not a bug: a source that defines no cookies ships
`security:cookies` with zero rules, and the coverage record says so.
