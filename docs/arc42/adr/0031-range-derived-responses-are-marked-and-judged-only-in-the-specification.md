# ADR-0031: A Range-Derived Response is marked on its node, and only the specification is judged by it

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-11-27 | —          | —             |

## Context

The OpenAPI plugin expands a status code range (`1XX`–`5XX`) into one response node per
registered code in that range; a code the specification documents under its own key wins over
the range for that status. Nothing on the resulting node said which of the two it came from, so
a `501` the description wrote and a `501` that only `5XX` implies were indistinguishable.

Rules about a single code misfire in `Lint` on such a **Range-Derived Response**.
`rfc9110/402-status-code-is-reserved` flags every operation that documents `4XX`;
`general-purpose-servers-must-support-get-and-head` cannot declare `lint` without flagging every
GET/HEAD that documents `5XX`
([#172](https://github.com/thymianofficial/thymian-workspace/issues/172), private repository).
About 45 other `lint` rules keyed on one code — `Allow` on a 405, `WWW-Authenticate` on a 401,
`Location` on a 3xx — would judge a range-derived node the same way.

Whether a status was documented explicitly is a fact about the specification. A server that
really sends a `501` sent it, however the specification wrote it down.

## Decision

### The node records the range it was derived from

`ThymianHttpResponse` gains an optional `derivedFromRange?: HttpStatusCodeRange` (`'1XX'` …
`'5XX'`). The OpenAPI plugin sets it on every node it builds from a range. A node for an
explicitly documented code, and a `default` node
([ADR-0027](0027-default-is-a-response-node-and-matching-is-staged.md)), carry none. The
expansion itself and the precedence of an explicit code are unchanged.

### A rule opts in with the `explicitlyDocumented()` filter

A new response filter, `explicitlyDocumented()`, composed with the status filters through
`and(…)`:

```ts
ctx.validateCommonHttpTransactions({
  appliesTo: and(statusCode(402), explicitlyDocumented()),
  violatedWhen: constant(true),
});
```

It judges only the specification:

- **Against a response node** — in `Lint`, on `Test`'s first, spec-side pass of `appliesTo`
  ([ADR-0025](0025-applicability-and-violation-condition.md)), and in a test-builder's
  `forTransactionsWith` — it is false on a range-derived node.
- **Against an observed response** — the recorded pair in `Analyze`, the live pair on `Test`'s
  re-check, a test-builder's live expectations — it is `true`: the server really sent that
  status, so nothing is excluded.

So in `Test` no request is sent for a range-derived transaction a rule excluded, and in
`Analyze` a recorded `402` is a violation whatever the specification documents.

Three placements follow from "judges only the specification":

- **`default` nodes.** It is a status filter in ADR-0027's sense: "explicitly documented" means
  documented under its own code, and a `default` response has none. It never matches a
  `default` node; `not(explicitlyDocumented())` does.
- **Inside `responseWith(…)`** it always judges the declared response nodes, in every context,
  because `responseWith` asks what the specification declares.
- **In the OpenAPI load-time operation filter** it is always `true`. There each response filter
  asks whether an operation has some such response, and `statusCode(n)` already sees only
  explicitly documented codes.

It is not a group-by key: a grouped call rejects it with the existing unsupported-group-by
error.

It is opt-in. The status filters keep their meaning, and each rule decides whether a range is
enough to speak about a code. Rules adopt it one by one: #172 for the two rules above, a
separate audit for the rest.

A Range-Derived Response is printed like any other: its `Selector` keeps the concrete code.
Because an explicit code wins, no operation documents one code both ways, so the selector stays
injective without a mark ([ADR-0023](0023-selector-is-the-transaction-label.md)).

### Rejected alternatives

- **A range as one node with status `'5XX'`**, as `default` is one node. `statusCode(501)`
  would no longer match a range-documented 501 anywhere, and `Analyze`'s concrete-status match
  tier (ADR-0027) would need a range tier between it and `default`.
- **Make the status filters skip range-derived nodes by default when judging the
  specification.** It would fix every rule at once, but silently change the `Lint` output of
  every rule keyed on a status, including those meant to match the range — the kind of hidden
  change of meaning ADR-0025 removed.
- **An option on each status filter** (`statusCode(402, { explicitOnly: true })`). One concept
  spread over `statusCode`, `statusCodeRange` and `successfulStatusCode`.
- **A negative `rangeDerived()` filter.** Its observed-response answer would have to be
  `false`, so a rule that used it bare in `Analyze` or `Test` would silently select nothing.

## Consequences

**Positive:**

- A `Lint` rule can tell a code the specification wrote from one a range implies.
- `Analyze` and `Test` keep reporting a server that really sends the code.
- Additive: no existing filter, rule or node consumer changes behaviour.

**Negative:**

- Node IDs are a hash of the node's content, so every range-derived node gets a new ID and the
  format hash of every specification with a range changes. As with ADR-0027, `report merge`
  does not key on it, so the effect is cosmetic across reports from before and after.
- A filter whose answer depends on what is observed is one more thing a rule author has to
  learn; the rule-authoring guide states it.
- Until the audit is done, the other single-code `Lint` rules still misfire on ranges.

## Related

- [ADR-0025](0025-applicability-and-violation-condition.md): `appliesTo` is asked of whatever
  the context observes, which is what this filter's two answers follow.
- [ADR-0027](0027-default-is-a-response-node-and-matching-is-staged.md): `default` response
  nodes, which carry no range and which the status filters never match.
- [ADR-0023](0023-selector-is-the-transaction-label.md): the selector, unchanged.
- [#819](https://github.com/thymianofficial/thymian-workspace/issues/819) (private
  repository).

---

## Status History

| Date       | Status   | Notes         |
| ---------- | -------- | ------------- |
| 2026-11-27 | Accepted | Initial draft |
