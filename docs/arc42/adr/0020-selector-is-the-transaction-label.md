# ADR-0020: The Selector is the transaction label, application-wide

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-09-04 | —          | —             |

## Context

[ADR-0019](0019-virtual-samples-and-selector-anchored-hooks.md) made the
**Selector** the address of a Transaction: `METHOD /path (+reqMedia) -> STATUS
(+resMedia)`, host-stripped, ASCII, one Selector ⇔ one Transaction. A hook is
anchored to it, `sampler show` takes it as an argument, and the committed type
surface is keyed by it.

Thymian already had a way of writing a Transaction down, from long before
selectors existed: a display string built by `thymianHttpTransactionToString`,
`GET /launches - application/json → 200 OK - application/json`. It is what
`sampler check` prints per line, what `httpTest` names a test case, what a rule
violation's heading says, what a report location resolves to, and what
`thymian request` lists. So the tool grew two spellings of one thing, differing
in the separator, the media-type delimiter and a reason phrase.

The manual-testing round on the v2 branch is where that stopped being a
cosmetic observation. A user watching `sampler check` fail on a transaction
reads its line, copies it, and pastes it into `beforeEach(...)` to shape the
request — and the paste does not resolve, because the line was never a Selector.
The verbatim quote from the feedback:

> while the general idea of selectors is good, they should be the same like the
> labels printed to the terminal. […] users should take selector
> `POST /launches/{id}/crew-members - application/json → 409 CONFLICT` [and]
> declare a hook.

Two spellings for one concept is one too many, and the terminal is where the
user meets it. The two candidate resolutions are symmetric on the surface —
either the labels adopt the selector grammar, or the selector grammar adopts the
label format — and are not symmetric at all underneath.

## Decision

We will make the **Selector grammar the single spelling of a Transaction
everywhere Thymian writes one**: `sampler check` lines, hook-failure
attribution, `httpTest` test-case names and the error texts of the http-testing
pipeline, rule headings, report locations, and the transaction listing of
`thymian request`. Anything a user reads off a surface pastes back as a hook
target unchanged.

- **Halves for half-labels.** A label that names only a request or only a
  response uses the corresponding half of the grammar — a request half reads
  `POST /launches (application/json)`, a response half `201 (application/json)`
  — rather than a third format. The halves compose into the whole by
  construction, so there is one grammar to learn and one to maintain.
- **Reason phrases leave labels.** `201 CREATED` becomes `201`. The phrase is
  derivable from the status code, it is not part of the Selector, and carrying
  it would put a second spelling back. Failure _detail_ text is free to spell a
  phrase out where it aids the sentence; the constraint is on labels.
- **The selector renderer moves into `@thymian/core`.** The renderer and its
  encoders (method, path, media type) are pure functions of core's
  `ThymianHttpRequest` / `ThymianHttpResponse`, and core is where the label
  functions live that every surface already calls. `@thymian/plugin-sampler`
  imports them from core and keeps everything selector-specific that is not
  rendering: parsing, near-miss diagnostics, the transaction catalog, filters
  and globs.
- **This is a deliberate amendment to the containment property of the v2
  specification.** ADR-0019 states that the redesign requires no `@thymian/core`
  change. It now requires exactly one, and only this one:
  `thymianRequestToString`, `thymianResponseToString` and
  `thymianHttpTransactionToString` render selectors, and the renderer that backs
  them lives beside them. `@thymian/plugin-openapi` stays untouched, and no
  event, action or rule contract changes.
- **Rendering stays total and injective.** Relocation is a move, not a rewrite:
  a path or media type that would collide with the grammar is encoded, never
  rejected, so no legal API description can make a label unprintable — which is
  a stronger property than the display string it replaces had.

### Rejected: keep two spellings, or make the Selector adopt the label format

The feedback offered both directions, and the label format loses on three
counts:

- **The arrow is not ASCII.** `→` (U+2192) is one keystroke nobody has. A
  Selector is typed into source code and pasted between terminal, editor and
  issue tracker; `->` survives that trip, a non-ASCII arrow invites
  transcription errors and mojibake.
- **The reason phrase is derivable and unstable.** `409 CONFLICT` carries no
  information `409` does not. It is a second thing to render consistently, it
  varies by registry vintage for the statuses that have no registered phrase,
  and it makes the label of a vendor status (`499`) either empty-suffixed or
  special-cased.
- **A spaced hyphen cannot delimit a media type.** RFC 9110 media-type
  parameters may be quoted strings, which may contain spaces, hyphens and `→`.
  The parenthesized, quote-aware media group of the Selector grammar is what
  makes rendering injective for those; the display string's `" - "` delimiter is
  ambiguous the moment a parameter contains one.

Against that, the selector grammar's totality and injectivity were already
settled, implemented and tested work. Adopting the display format would have
meant re-deriving both properties on a grammar chosen for looks, and the
feature that depends on them — pasting a printed line back as a hook target —
is the whole point.

## Consequences

**Positive:**

- One grammar, learned once. Every printed transaction is a hook target, which
  is the affordance the feedback asked for and the reason the Selector exists.
- The half-labels compose, so a request-only heading and a response-only
  heading are prefixes and suffixes of the transaction label rather than three
  unrelated strings.
- Labels inherit totality and injectivity from the renderer: an odd-but-legal
  description (whitespace in a path, a quoted-string media parameter) prints a
  label that is still unambiguous and still resolvable.

**Negative:**

- **Terminal output changes for every user**, not only sampler users: check
  lines, test-case names, rule headings and report locations all lose their
  reason phrases and change their separators. Anything downstream that reads
  Thymian's human output by pattern breaks — which is why the machine-readable
  surfaces (`--json`, the report model) are the contract to build on, and a
  precondition of this decision was verifying that no persisted artifact of
  ours keys on the old strings.
- Core carries a grammar it does not itself consume as an address. The renderer
  is a labeling concern in core and an addressing concern in the sampler; the
  two must not drift, and the parser that closes the loop lives in the plugin.
- Losing the reason phrase costs a little scannability for readers who used it
  to spot a status class at a glance.

**Neutral:**

- The round-trip property is the test that keeps the decision honest: every
  transaction label `sampler check` prints must parse as a Selector that
  resolves in the transaction catalog.
- Labels of _captured traffic_ (`httpRequestToLabel` and friends, used by
  `@thymian/plugin-http-analyzer`) are out of scope: an observed request carries
  a concrete URL rather than a path template, so it is not a Transaction of a
  description and has no Selector.
- Thymian Format node and edge `label` attributes are unchanged. They are
  persisted graph data, host-qualified, and participate in the format hash; the
  decision is about what Thymian _prints_.

## Related

- [ADR-0019](0019-virtual-samples-and-selector-anchored-hooks.md): defines the
  Selector this decision promotes to a label, and states the containment
  property this decision amends. Its grammar sketch predates the refinement
  that media parts appear whenever a node _declares_ a media type rather than
  only when a body exists; `CONTEXT.md` is canonical for the grammar.
- [ADR-0007](0007-core-owns-validation-entrypoints-plugins-own-execution.md):
  the core/plugin boundary. Moving a pure renderer of core types into core is
  consistent with it — no execution moves.
- [Chapter 8](../08-crosscutting-concepts.md): the Thymian format graph, whose
  request/response nodes the renderer is total over.
- [Quality Requirement 10.2.1](../10-quality-requirements.md#102-quality-scenarios):
  Learnability — the printed line and the authoring address become the same
  string.
- [thymian-internal#466](https://github.com/thymianofficial/thymian-internal/issues/466)
  (private repository): the amended v2 specification, §1 and §3, and the
  manual-testing feedback round this decision comes from.

---

## Status History

| Date       | Status   | Notes                                                                                                         |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| 2026-09-04 | Accepted | The Selector grammar becomes the application-wide transaction label; the renderer moves into `@thymian/core`. |
