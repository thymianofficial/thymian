// The coverage record: the typed denominator/numerator artifact a **spec**
// rule-set package carries so the gap between a source document and the
// rules that check it is computed, never asserted. Rationale in ADR-0021 §5
// (`docs/arc42/adr/0021-http-security-rule-sets.md`) and
// `.github/skills/add-http-rule-set/reference/coverage-record.md`.
//
// Authored **per rule, not per unit** — that is the only shape that can
// carry the declared-type stamp, which is what makes a *stale* reason
// detectable rather than only a missing row. A rule's entry carries what it
// covers, the stamp (its declared types and severity), and cells for the
// contexts it says something about beyond what `.type()` already implies.
//
// This module is the type surface only: the record it describes is authored
// standalone, ahead of and separately from the rule files it describes, and
// is later cross-checked against them (the coverage checker, a later
// ticket). Nothing here reads an actual `Rule`.

import type { ContextReason, IssueReference } from './rule-impossibility.js';
import type { RuleType } from './rule-meta.js';
import type { RuleSeverity } from './rule-severity.js';

// The three contexts a coverage record can speak about. 'informational' is
// deliberately excluded: an informational rule's three cells all come from
// the whole-rule reason slice 2 already made authoritative (see
// `CoverageEntry` below), so a record cannot state a second claim here that
// might disagree with it inside one release.
export type CoverageContext = Exclude<RuleType, 'informational'>;

export const coverageContexts: readonly CoverageContext[] = [
  'static',
  'analytics',
  'test',
];

// The vocabulary a cell's `verdict` is drawn from, named on its own so the
// checker and renderer (later tickets) have one place to import it from
// rather than re-deriving it from `CoverageCell`.
export type CoverageVerdict = 'observable' | 'heuristic' | 'impossible';

// A cell states what a rule can say about one context. Bare 'observable'
// and 'heuristic' are only ever written to mark a *declared* context
// heuristic — a declared context defaults to 'observable', so writing that
// value explicitly is never required, only writing 'heuristic' is. An
// 'impossible' cell explains why an *undeclared* context has no row of its
// own to omit.
//
// The two-branch 'impossible' shape repeats `RuleImpossibility`
// (`rule-impossibility.ts`) on purpose: typing the non-`tool-limitation`
// branch as an `Exclude` gives the branches disjoint discriminants, which is
// what lets `reason === 'tool-limitation'` narrow to the branch that has
// `.issue` — the fix on thymianofficial/thymian#406, repeated here.
export type CoverageCell =
  | 'observable'
  | 'heuristic'
  | {
      verdict: 'impossible';
      reason: Exclude<ContextReason, 'tool-limitation'>;
      note: string;
    }
  | {
      verdict: 'impossible';
      reason: 'tool-limitation';
      issue: IssueReference;
      note: string;
    };

// The declared denominator. A source with no denominator never refuses a
// package — some documents have none — but an undeclared counting rule
// does, because it is the difference between "this source cannot be
// counted" and "nobody tried": `countingRule` is required where `revision`
// and `substituteLabel` are the two fields that may vary.
//
// `hasKeywordBasis` is declared, not derived from `countingRule`'s own
// prose: a real BCP-14-keyword source can describe its counting rule
// without ever using the word "keyword" (RFC 6797's is "MUST/SHOULD
// statements... addressed to an HSTS Host"), and a source with no keyword
// basis at all can still mention the word while explaining why it doesn't
// apply. `countingRule` is written for a human reader of the rendered
// README; `hasKeywordBasis` is the one bit the coverage checker's
// citation-requirement assertion (a later ticket) needs and can trust,
// because nothing about it is inferred from text meant for something else.
export type CoverageSource = {
  revision: string;
  countingRule: string;
  hasKeywordBasis: boolean;
  substituteLabel?: string;
};

// Every unit the source document enumerates, keyed by its own id and
// carrying a short description — the shape `covers` binds against below.
export type CoverageUnits = Record<string, string>;

// One rule's entry. A **union**, not a single shape gated by a conditional
// on an inferred type parameter: TypeScript's excess-property checking
// across a plain union is lenient (a property known to *any* member is
// never flagged as excess), so the only reliable way to refuse `contexts`
// on an informational entry is to give that branch its own `contexts?:
// never` — a real type mismatch, not a leniently-ignored excess key.
//
// This also settles the acceptance criterion left open on purpose: the
// refusal is type-level, not the checker's — the checker (a later ticket)
// needs the record cross-checked against real rule files, which this
// module never sees.
//
// The `declared.types` shape on the informational branch — exactly
// `['informational']`, not `RuleType[]` — mirrors `.type()`'s own rule that
// 'informational' cannot combine with an executable type
// (`rule-builder.ts`'s `InformationalMixedWithExecutableTypes`). It is not
// re-derived independently; it is required here only because the
// informational/executable split is what the union discriminates on.
export type CoverageEntry<Units extends CoverageUnits = CoverageUnits> =
  | {
      covers: (keyof Units)[];
      declared: { types: readonly ['informational']; severity: RuleSeverity };
      contexts?: never;
    }
  | {
      covers: (keyof Units)[];
      declared: {
        types: readonly [
          Exclude<RuleType, 'informational'>,
          ...Exclude<RuleType, 'informational'>[],
        ];
        severity: RuleSeverity;
      };
      contexts?: Partial<Record<CoverageContext, CoverageCell>>;
    };

export type CoverageRecord<
  Units extends CoverageUnits = CoverageUnits,
  Rules extends Record<string, CoverageEntry<Units>> = Record<
    string,
    CoverageEntry<Units>
  >,
> = {
  source: CoverageSource;
  units: Units;
  rules: Rules;
};

// The authoring helper. Not a bare `satisfies`: `satisfies` checks a
// literal against one fixed type and cannot itself bind `covers` to the
// unit ids declared three lines up in the same literal — there is no type
// to write down that isn't already the answer. `defineCoverage` infers
// `Units` from the literal's own `units` field first (as a `const` type
// parameter, so its keys stay literal rather than widening to `string`),
// and that concrete `Units` is what then contextually types every entry's
// `covers`, catching an unknown unit id as a compile error at the entry
// that names it.
//
// The return type maps every entry to the plain `CoverageEntry<Units>`
// union rather than returning `Rules` as inferred: a `const` type parameter
// preserves each entry's *exact* literal — an entry written without a
// `contexts` key infers with no such property at all, not an optional one
// — so callers could not read `.contexts` on an entry that omitted it, even
// though the type says the property is optional. Checked against the real
// built declaration (not raw source): consumers only ever see the emitted
// `.d.ts`, so that is what has to hold, and only the mapped form does.
export function defineCoverage<
  const Units extends CoverageUnits,
  const Rules extends Record<string, CoverageEntry<Units>>,
>(record: {
  source: CoverageSource;
  units: Units;
  rules: Rules;
}): CoverageRecord<Units, { [RuleName in keyof Rules]: CoverageEntry<Units> }> {
  return record;
}
