# ADR-0022: Rule validation calls name their applicability and violation condition separately

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-09-24 | —          | —             |

## Context

The rule-context methods `validateCommonHttpTransactions`, `validateHttpTransactions` and
`validateGroupedCommonHttpTransactions` take a filter expression and, optionally, a second
argument that is either another expression or a validation function. The first argument
changes meaning with the shape of the call:

| Call shape                    | First argument means | Evaluated against the pair that came back in `Test`? |
| ----------------------------- | -------------------- | ---------------------------------------------------- |
| one argument                  | the condition        | yes                                                  |
| second argument an expression | which transactions   | yes, the second argument                             |
| second argument a function    | which transactions   | **no**                                               |

On the third shape the `Test` context selected transactions from the specification and then
handed every live pair to the function unchecked. The `Analyze` context applied the same
filter to recorded traffic before calling the function, so one rule meant different things
in two contexts.

The consequence was false violations. `sender-should-generate-content-type-for-message-with-content`
filters on `and(hasResponseBody(), not(responseHeader('content-type')))` and its function
returns a violation unconditionally. OpenAPI never declares `Content-Type` as a response
header, so on the specification that filter is true for every response with a body, and
`thymian test` reported a missing `Content-Type` on responses that carried one. Against
`thymian-demo`, 20 of a run's 32 warnings were false. Five rules reachable in `Test` were
built this way. About 27 more selected by described status or method and never saw the
live status, so a rule for 405 responses validated a 204.

Nothing at the call site signals the change of meaning: adding a second argument to
customise a message silently demotes the first from condition to selection. Every rule
author in this repository who hit it did not notice, and a user writing a custom rule
would hit it the same way.

The narrow fix — re-apply the filter to the live pair inside the `Test` context — removes
the false violations without touching a single caller. It leaves the trap in place.

## Decision

We will make the two roles explicit in the signature of every rule-context validation
method, with named keys:

```ts
ctx.validateCommonHttpTransactions({
  appliesTo: statusCode(405),
  violatedWhen: (req, res, location) => (hasAllow(res) ? [] : [violation(location)]),
});
```

- **`appliesTo`** is the rule's `Applicability`. It is required. In `Lint` it is evaluated
  against the specification; in `Analyze` against the recorded pair; in `Test` against the
  specification to choose which requests to send, and then again against the pair that came
  back. A pair it rejects never reaches `violatedWhen`.
- **`violatedWhen`** is the rule's `Violation Condition`: either a filter expression (the
  pair violates the rule when it matches) or a function returning results. It is evaluated
  only against applicable pairs, against the same observation as `appliesTo`'s final check.

This applies to `validateCommonHttpTransactions`, `validateHttpTransactions` and
`validateGroupedCommonHttpTransactions` on every context, and `LintContext.validateHttpTransactions`
adopts the same keys so one vocabulary spans the three commands.

There is no separate parameter for "what to send". A rule whose applicability the
specification cannot answer states the live-only part in `violatedWhen`. The framework
guarantees what `appliesTo` and `violatedWhen` mean; whether a rule states its logic
correctly within them is the rule author's responsibility.

For `appliesTo` to mean the same in every context, the `Test` context's live filter
evaluator matches the other two: method, header and trailer names compare
case-insensitively, `protocol` is read from the request origin, and `isAuthorized` is read
from the specification (`requestIsSecured`) through the transaction's source.

The positional signatures are removed outright, not deprecated. Thymian is pre-1.0 and a
deprecated overload would keep the trap open for exactly the users this protects.

## Consequences

**Positive:**

- A validation function in `Test` can no longer report a fact about the specification as a
  fact about live traffic.
- `Test` and `Analyze` agree on what a rule applies to.
- Each call site says which part selects and which part judges; leaving one out is a
  compile error.
- Rules whose condition was a live-only fact in the filter (`Content-Length` on a 204, for
  instance) now send requests in `Test` and can find real violations, where before the
  specification selected nothing.

**Negative:**

- Breaking change to the public rule API: every custom rule calling these methods must
  migrate. Released as a minor bump under the 0.x convention, with a migration note.
- Around 290 call sites across rule sets, tests, docs and skills are rewritten.
- Rules that selected on a live-only fact now exercise more transactions in `Test`, so runs
  send more requests.
- Case-insensitive live matching can surface violations that were silently missed before.

**Neutral:**

- The status-code gate that skips non-passing test cases (`checkStatusCode`) is untouched;
  it is a separate under-reporting problem.
- Nothing stops a rule from putting a live-only predicate in `appliesTo`; it then selects
  nothing in `Test`, which is a rule-authoring error, not a framework one.

## Related

- [Chapter 8](../08-crosscutting-concepts.md): rule contexts
- [ADR-0021](0021-http-security-rule-sets.md): the executability gate rule authors follow

---

## Status History

| Date       | Status   | Notes         |
| ---------- | -------- | ------------- |
| 2026-09-24 | Accepted | Initial draft |
