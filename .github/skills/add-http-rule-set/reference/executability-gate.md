# The executability gate

Reference for step 3 of [`../SKILL.md`](../SKILL.md). Rationale in
[ADR-0021 §4](../../../../docs/arc42/adr/0021-http-security-rule-sets.md).

The tables below are the procedure — the questions to ask while judging. The vocabulary
itself is generated from `packages/core/src/rules/rule-impossibility.ts` and cannot drift
from these tables: [Impossibility Reasons](https://thymian.dev/references/impossibility-reasons/)
is the canonical list, so a code added there is visible without editing this file.

## Verdict per cell

For each source unit, ask of **each** of `static`, `test`, `analytics`:

1. **Can this context evaluate the assertion exactly?** → _observable_.
2. **Is it visible on the wire without strictly implying non-conformance?** →
   _heuristically observable_. Legal, never at `error`; rides at `warn`/`hint`.
   Heuristic-ness attaches to an assertion **in a context**, so the same assertion can be
   exact in `static` and a guess in `analytics`.
3. Otherwise → _impossible_, with a code from the vocabulary below.

Three cells, three answers, per unit. A rule then declares exactly the contexts that came
back observable or heuristically observable.

## Picking an impossibility code

Ask in this order; the first yes is the code.

**Is the blocker Thymian, or the world?**

Thymian → **`tool-limitation`**, and cite the tracker issue. It is refused at the type level
uncited, because an uncited tool gap is indistinguishable from a permanent one. A gap one
layer deep belongs here: `serializeHeaders` returns `Record<string, string>`, so a probe
needing two field lines of one header name cannot be sent today, even though
`HttpRequest.headers` already accepts `string[]`.

The world → keep going.

**Does it block every context, or one?**

Every context, permanently → **tier 1**, and the rule is `informational`:

| Code                  | Claim                                                          |
| --------------------- | -------------------------------------------------------------- |
| `only-origin-knows`   | Only the origin knows the fact the statement is about          |
| `peer-not-observable` | The obligation is on a peer whose internals are not observable |
| `nothing-to-check`    | No HTTP message can conform to it or violate it                |

`nothing-to-check` covers two shapes, and only these two: a **statement of fact or a
definition** (`header-section-consists-of-field-lines` defines what a header section is), and
a **requirement addressed to whoever writes a specification** rather than to a message
(`new-fields-should-limit-values-to-visible-ascii` constrains the author of the next field
definition; no transaction can violate it).

**A BCP 14 `MAY` does not land here.** A `MAY` is checkable at `hint`: the finding reads
"the protocol offers this mechanism and it is not being used", which claims no
non-conformance, so the permission is not a reason the rule is impossible. Ask a `MAY` the
same question you would ask a `MUST` — _if the actor exercised or declined this permission,
would Thymian see a difference in the messages available to it?_ A difference visible inside
one transaction, or across a captured trace (`validateCapturedHttpTraces` hands a rule the
whole `CapturedTrace`, which is how `server-should-send-same-header-fields-in-response-to-head`
compares two of them), makes the rule executable at `hint`. It is `informational` only where
the answer is genuinely no: the act stays inside a peer (`peer-not-observable`), it turns on
origin state (`only-origin-knows`), or Thymian cannot do it yet (`tool-limitation`, cited).

One context → **tier 2**, recorded in `coverage.ts` against that context:

| Code                        | Claim                                                                |
| --------------------------- | -------------------------------------------------------------------- |
| `participant-not-reachable` | Thymian occupies the role, or cannot be positioned in it             |
| `condition-not-producible`  | The participant is reachable, the situation is not                   |
| `requires-controlled-input` | Recorded traffic cannot say whether the condition _should_ have held |
| `not-representable`         | The artifact does not carry the shape the assertion needs            |

`tool-limitation` is the only code in both tiers. The distinction it draws — us versus the
world — is orthogonal to the distinction between one context and all of them.

### The invariant

**A rule is `informational` if and only if it declares no context.** Tier 1 is the only
place a tier-1 reason may appear, and it appears as `.type('informational', reason, note)`.

### Two codes that look right and are not

- **"The specification does not pin the value."** Not an impossibility reason. A package's
  `coverage.ts` ships inside the package and cannot see the user's specification, so a
  document-dependent verdict would make the README lie for half its readers. Declare the
  context and emit a runtime `rule-skip` with a reason instead.
- **`requires-provocation`.** Not an impossibility. It is a claim about Thymian's sending
  capability, and `plugin-sampler` is pluggable — so it is `tool-limitation` with an issue.

## What each context can see

**The common interface is value-blind.** `validateCommonHttpTransactions` sees header,
query, cookie and trailer **names**, and the body only as a boolean. Anything needing a
**value**, a **second message**, or a **participant's identity** needs an override — in
every context, not just the awkward ones. This is the single most useful trigger for
choosing between `.rule()` and the overrides.

`.rule()` is not a synonym for the common interface. The context it hands you narrows as
you declare more types, and `('analytics', 'test')` alone yields a `LiveApiContext` tier
carrying real values. Combinator support is not uniform across contexts, but an unsupported
combinator **throws** rather than matching nothing silently.

### `static` — the Thymian Format

Pinned header **values** are reachable here, through `.overrideStaticRule()`:
`ThymianSchema` carries `const`, `enum`, `examples` and `pattern`. So "not observable in
`static`" is a claim about whether the document **pins** the value, never about the context
being name-only.

Three traps:

- **Duplicate field lines are absent** from the format, and no context has a count
  primitive. An assertion about two field lines of one header name is `not-representable`
  in `static`.
- **Server URLs are lossy and silently wrong.** A document with no `servers` loads as a
  fabricated `http://localhost:8080`, and so does one whose server URL is relative or has an
  unresolvable variable in the scheme or the port — the parse throws into an empty `catch` —
  so `https://api.example.com:{port}/v1` lints as `http`. Expect false violations from "must be
  https" assertions and empty selection from any rule scoped `protocol('https')`. Scope
  around it rather than asserting through it: skip exactly that origin, with a `rule-skip`.
  The fallback reaches `test` too (below); `analytics` never sees it, because recorded
  traffic is real.
- **A runtime skip needs a function validator.** The lint context's
  `validateHttpTransactions` keeps only results that carry a violation, so a `rule-skip` for
  an unpinned value vanishes into a pass. Emit it from `validateCommonHttpTransactions` with a
  function validator instead, reading the described transaction back through
  `ctx.format.getThymianHttpTransactionById(location.elementId)`.

### `test` — live endpoints

`test` sends only what the specification describes, which is a property of the context
rather than a per-rule defect. Where it is the specific blocker for one unit, that is
`condition-not-producible`.

**The candidate filter selects described transactions.** It decides what `test` sends,
from the description, so a response-side condition in it — `responseHeader(...)`, a status
— sends only the requests whose description already declares that response, and never sees
the server doing what the description does not say. Keep the candidate filter request-side
and judge the live response in the validator.

**The server-URL fallback reaches `test`.** A request keeps its described origin even when a
target URL sent it elsewhere, so a scheme read from it is the description's, fallback
included. Skip the fallback origin here exactly as in `static`.

**Probes.** A rule may send a benign robustness probe behind the explicit per-target consent
switch, which is **off by default** and scoped by `skipOrigins`. Once on, there is no method
restriction: `thymian test` already replays state-changing traffic unconditionally, so
restricting probes by method would be stricter than the rule already applied to ordinary
test traffic. The surviving constraint is **payload shape** — a probe is a well-formed
message the spec permits, which keeps path traversal, injection and credential stuffing out
on their own merits.

A probing rule **declares itself**, so its coverage record can render what it sends; a
consent gate is worthless if the operator cannot see what consenting admits. With the gate
off the rule emits `rule-skip` with a reason. Declining a probe never yields
`informational`.

The status-code gate in step 5 applies to every `test` fixture, probe or not.

### `analytics` — recorded traffic

Carries real values and real message pairs, and is the context most likely to be _heuristic_:
recorded traffic shows what happened, not what should have. A conditional-request rule can
see an `If-Match` and cannot see whether it ought to have matched — `requires-controlled-input`.

## Handing over mid-source

The verdict table is the hand-off artifact. Split between steps, never inside step 3: a
half-surveyed source reads exactly like a fully-surveyed one whose author stopped at the
first context that worked.
