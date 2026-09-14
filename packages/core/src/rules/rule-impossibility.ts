// The closed impossibility-reason vocabulary. Tier 1 is a whole-rule,
// permanent claim about the world — it is what makes a rule `informational`,
// declared on `.type('informational', reason, note)`. Tier 2 records why one
// context is missing from an otherwise-executable rule, for the coverage
// record; it ships now with no caller, exactly as `tagMatches` shipped ahead
// of the tag filter, so the coverage record's verdict keys are final before
// it is written. See
// `.github/skills/add-http-rule-set/reference/executability-gate.md` for how
// to choose a code; adding one later is a free union widening.
export const tier1ImpossibilityReasons = {
  'origin-internal-ground-truth':
    'Only the origin knows the fact the statement is about.',
  'peer-internal-behaviour':
    'The obligation is on a peer whose internals are not observable.',
  'permission-or-statement-of-fact':
    "A 'MAY', or a statement that asserts nothing to check.",
  'tool-limitation':
    'Thymian could do this in principle; the implementation cannot yet.',
} as const satisfies Record<string, string>;

// Declared flat, separately from any grouping, so a mistyped code reports a
// `keyof typeof <object literal>` union — printed member-by-member — rather
// than an alias name that teaches nothing. Same idiom `rule-tags.ts` uses for
// `RuleTag`.
export type WorldReason = keyof typeof tier1ImpossibilityReasons;

export const tier2ImpossibilityReasons = {
  'participant-not-reachable':
    'Thymian occupies the role, or cannot be positioned in it.',
  'condition-not-producible':
    'The participant is reachable, the situation is not.',
  'requires-controlled-input':
    'Recorded traffic cannot say whether the condition should have held.',
  'not-representable':
    'The artifact does not carry the shape the assertion needs.',
  'tool-limitation':
    'Thymian could do this in principle; the implementation cannot yet.',
} as const satisfies Record<string, string>;

export type ContextReason = keyof typeof tier2ImpossibilityReasons;

// The glossary term: both tiers together. `tool-limitation` is deliberately
// the only code in both — the distinction it draws (us versus the world) is
// orthogonal to the distinction between one context and all of them.
export type ImpossibilityReason = WorldReason | ContextReason;

// A shape guard, not a parser: `#123` and `org/repo#123` are both legal,
// `soon` is not. `tool-limitation`'s issue is a required argument rather than
// an optional field precisely so this type has a call site to guard.
export type IssueReference = `${string}#${number}`;

// Structurally a discriminated union on `reason`. Written as
// `Exclude<WorldReason, 'tool-limitation'>` rather than `WorldReason` (the
// literal shape the ADR sketches) so the two branches have disjoint
// discriminants — otherwise `reason === 'tool-limitation'` cannot narrow away
// the issue-less branch, and `.issue` stays unreachable after the check the
// type exists to enable.
export type RuleImpossibility =
  | { reason: Exclude<WorldReason, 'tool-limitation'>; note: string }
  | { reason: 'tool-limitation'; issue: IssueReference; note: string };
