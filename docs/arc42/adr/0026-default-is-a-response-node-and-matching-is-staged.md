# ADR-0026: `default` is a response node, and matching resolves the operation before the response

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-11-16 | —          | —             |

## Context

`thymian analyze` matches each recorded request/response pair to a Transaction
of the Thymian Format with `ThymianFormat.matchTransaction`. Until now that
match was one conjunction — method, path, origin, response status and both
media types — tried at three tiers (exact path, strict template, relaxed
origin). A recorded response whose status the API specification does not list
therefore failed the _whole_ match, and every rule reported it as "No matching
endpoint found", although the operation was documented. Request-scoped rules
were skipped although they could run, and the undocumented response itself went
unreported ([#465](https://github.com/thymianofficial/thymian-workspace/issues/465),
private repository).

Fixing that means telling an **Undocumented Response** apart from an unknown
operation. That distinction is only honest if Thymian knows every response the
specification documents — and it did not: the OpenAPI plugin dropped
`responses.default` outright. On the many specifications that document their
errors through `default`, every error status would have been reported as
undocumented. Modelling `default` was therefore a precondition, not an
extension.

`ThymianHttpResponse.statusCode` was typed `number`, read by roughly forty
source files across core, the sampler, the http-testing pipeline, the filter
compilers and the RFC rule sets.

## Decision

### `default` is a response node with status `'default'`

We will model an OpenAPI `default` response as ordinary `http-response` nodes,
one per declared media type (one node with media type `''` when it declares no
content), joined to the request node by ordinary `http-transaction` edges.
`ThymianHttpResponse.statusCode` becomes `number | 'default'`.

- **Selector.** The status part renders and parses as the literal `default`:
  `POST /v2/clock (application/json) -> default (application/json)`. Only the
  lowercase spelling is a selector; other casings are near-misses that get a
  "Did you mean".
- **Status filters.** `statusCode(n)`, `statusCodeRange(…)`,
  `successfulStatusCode()` and their siblings never match a `default` node, in
  every filter compiler; their negations do. A `default` response has no status,
  which is how the OpenAPI load-time filter already treated it. There is no
  "is default" filter.
- **Not a test target.** A `default` Transaction names no status a request could
  be aimed at. It is left out of `test` case generation and of sampling, is
  refused as a hook or seed target with a message that says so, and is absent
  from the generated type surface. It stays visible to `lint` and `analyze`, and
  `sampler show` may resolve it. The http-testing status check and the seed
  check are deliberately _not_ taught an "any undeclared status" rule.
- **Validation.** `response-body` and `response-headers` validate a response
  that only `default` covers against the `default` node, like any other.

### Matching resolves the operation first, then the response within it

We will make `matchTransaction` staged:

1. **Operation.** Method, path, origin and request media type, with the same
   three tiers as before (exact path → strict template → relaxed origin). No
   operation → the unknown-endpoint outcome, unchanged.
2. **Response, within that operation only**, in this order:
   1. A concrete status equal to the observed one (status-range declarations
      are already expanded to concrete codes). If that status exists but none
      of its media types matches, the response is undocumented by media type —
      it does **not** fall back to `default`, because OpenAPI selects the
      Response Object by status and the media type within it.
   2. Otherwise `default`, matched by media type. A media-type miss there is
      also undocumented by media type.
   3. Otherwise the response is undocumented by status.

A partial match — operation found, response undocumented — reaches rules as the
existing node form of `RuleViolationLocation`, pointing at the matched request
node. No type changes.

### Rejected alternatives

- **A sentinel status (`0`) plus an `isDefault` flag.** No type break, but every
  numeric comparison over the format would silently do the wrong thing. The
  union makes the compiler find each place that assumed a number, which is the
  review this change needs.
- **A separate `http-default-response` node type.** Every consumer of
  `http-response` — matching, lint rules, sampling — would ignore it silently.
- **A flag on the request node saying "this operation declares `default`".**
  Cheaper, but it leaves `default` responses unvalidated and pushes an
  OpenAPI-specific fact into a protocol-agnostic node.
- **Teaching `test` that a `default` Transaction expects "any undeclared
  status".** It would make `default` selectors hook targets, but a generated
  request almost never provokes such a status, and the expectation is too weak
  to say much when it does.
- **Keeping the single-conjunction match.** Besides conflating the two failure
  modes, it let a response missing on a concrete path fall through to a
  templated path that happened to document it, which contradicts OpenAPI's
  rule that a concrete path wins over a template.

## Consequences

**Positive:**

- `analyze` tells an unknown operation from an Undocumented Response, so
  request-scoped rules run on documented operations and the undocumented
  response can be reported by its own rule.
- Specifications that document errors through `default` are validated against
  it instead of being treated as silent on those statuses.
- The compiler enumerates every reader of a format status, so no consumer
  silently mishandles `default`.

**Negative:**

- **Breaking change to a public type.** `ThymianHttpResponse.statusCode` is
  read by third-party lint rules; numeric comparisons on it no longer compile
  until they handle `'default'`.
- **The format hash changes** for every specification that declares `default`,
  so its format version changes. `report merge` does not key on it, so the
  effect is cosmetic across reports from before and after.
- **Changed matches.** A recorded pair that used to match a templated path,
  while a concrete path for the same request exists, now resolves to the
  concrete path's operation — and may become an Undocumented Response there.
- A `default` selector resolves in `sampler show` but cannot be targeted, which
  is one more rule for a hook author to learn; the refusal message carries it.
  The `sampler.show` action response gains a `{ selector, notTested }` variant
  for it, a second public break.

**Neutral:**

- A recorded response that only `default` covers is documented, so it is not an
  Undocumented Response.
- A known method and path with an undocumented _request_ media type still
  matches no operation and keeps the unknown-endpoint message; that is
  [#739](https://github.com/thymianofficial/thymian-workspace/issues/739)
  (private repository).

## Related

- [ADR-0019](0019-virtual-samples-and-selector-anchored-hooks.md): the virtual
  samples, the committed type surface and the selector-anchored hooks that a
  `default` Transaction is excluded from.
- [ADR-0023](0023-selector-is-the-transaction-label.md): the Selector grammar,
  whose status part gains the literal `default`.
- [ADR-0013](0013-thymian-format-must-not-contain-circular-references.md): the
  format's structural constraints, which `default` nodes satisfy like any
  response node.
- [#465](https://github.com/thymianofficial/thymian-workspace/issues/465)
  (private repository): the analyze defect this decision resolves.

---

## Status History

| Date       | Status   | Notes                                                                                               |
| ---------- | -------- | --------------------------------------------------------------------------------------------------- |
| 2026-11-16 | Accepted | `default` modelled as response nodes, not a test target; `matchTransaction` staged operation-first. |
