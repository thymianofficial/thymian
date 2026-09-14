---
title: Impossibility Reasons
description: The closed vocabulary of reasons a rule, or one context of it, may be unobservable.
---

Generated from `tier1ImpossibilityReasons` and `tier2ImpossibilityReasons` in
`@thymian/core`. `tool-limitation` is the only code in both tiers: the distinction it draws
— Thymian's own implementation versus the world — is orthogonal to the distinction between one
context and all of them.

## Tier 1 — whole-rule, in the rule file

These make a rule `informational`: a claim about the world that holds in every context,
permanently. Passed as `.type('informational', reason, note)`.

| Code                              | Claim                                                              |
| --------------------------------- | ------------------------------------------------------------------ |
| `origin-internal-ground-truth`    | Only the origin knows the fact the statement is about.             |
| `peer-internal-behaviour`         | The obligation is on a peer whose internals are not observable.    |
| `permission-or-statement-of-fact` | A 'MAY', or a statement that asserts nothing to check.             |
| `tool-limitation`                 | Thymian could do this in principle; the implementation cannot yet. |

## Tier 2 — per-context, in the coverage record

These do not make a rule informational — the rule is executable. They record why one
context is missing from it.

| Code                        | Claim                                                               |
| --------------------------- | ------------------------------------------------------------------- |
| `participant-not-reachable` | Thymian occupies the role, or cannot be positioned in it.           |
| `condition-not-producible`  | The participant is reachable, the situation is not.                 |
| `requires-controlled-input` | Recorded traffic cannot say whether the condition should have held. |
| `not-representable`         | The artifact does not carry the shape the assertion needs.          |
| `tool-limitation`           | Thymian could do this in principle; the implementation cannot yet.  |
