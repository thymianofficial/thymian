// The coverage checker: the one function that answers whether a coverage
// record agrees with the rules a package actually ships. TypeScript proves
// a record is internally consistent at author time (`rule-coverage.ts`);
// this is the only lane that can see an *omitted* context, a *stale*
// declared-type stamp, or an entry that has drifted from the rules on disk
// — the failures the executability gate most needs caught, because nothing
// about them is a syntax error.
//
// A pure function over the record, the package's loaded rules, and
// optionally its shipped profiles and a committed/generated README pair.
// It is meant to be implemented **once** and invoked from two places — the
// package's own meta-test, and the generator's check mode (a later ticket)
// — so the gate and the generator cannot drift apart from each other.
//
// Implements #61's Enforcement table except its "Prettier-stable output"
// assertion: the generator formats its own output with the repo's Prettier
// config before writing, so the README-drift check below (comparing
// against a *generated* block the caller already produced) is what catches
// a reflow. Nobody should add a Prettier dependency to core looking for a
// missing assertion here — there isn't one to add.
//
// Three codes below (`unknown-unit`, `informational-entry-has-cells`,
// `malformed-tool-limitation-issue`) go past the numbered table: they
// re-verify invariants `rule-coverage.ts`'s type system already guarantees
// at *author* time, for a record this checker sees *loaded* — from a
// package's built `dist`, or hand-edited, where that guarantee no longer
// holds. Deliberate, not scope creep; the fixture tests for each simulate
// exactly that drift by mutating past the compile-time guarantee.

import type { Rule } from './rule.js';
import type { RulesConfiguration } from './rule-configuration.js';
import type {
  CoverageContext,
  CoverageEntry,
  CoverageRecord,
} from './rule-coverage.js';
import { coverageContexts } from './rule-coverage.js';
import type { RuleType } from './rule-meta.js';

export type CoverageViolationCode =
  | 'missing-entry'
  | 'orphaned-entry'
  | 'undeclared-context-cell-invalid'
  | 'stamp-mismatch'
  | 'unknown-unit'
  | 'informational-entry-has-cells'
  | 'malformed-tool-limitation-issue'
  | 'uncited-error-severity-rule'
  | 'undocumented-promoted-rule'
  | 'readme-drift';

// Data, not a thrown error: every violation names the rule or unit it is
// about (both, for a `covers` violation) and carries a human-readable
// `message` — a caller renders these directly rather than parsing an
// exception.
export type CoverageViolation = {
  code: CoverageViolationCode;
  rule?: string;
  unit?: string;
  context?: CoverageContext;
  message: string;
};

export type CoverageCheckInput = {
  record: CoverageRecord;
  // The package's rules loaded at baseline — no profile or user config
  // applied. That baseline is what a record's `declared` stamp and
  // `error`-severity citation requirement are checked against; a profile
  // only ever *promotes*, checked separately via `profiles` below.
  rules: readonly Rule[];
  // The package's own shipped profiles, exactly as `RuleSet.profiles`
  // carries them — not pre-loaded/merged rule sets. Promotion (assertion 8)
  // is read directly off a profile's own declared severity for a rule, so
  // there is nothing here for the caller to resolve first.
  profiles?: Record<string, RulesConfiguration>;
  // A subset of rule names. Loaded rules outside it, and record entries
  // outside it, are ignored entirely — neither a missing-entry nor an
  // orphaned-entry violation — so one sweep batch can check its own
  // directories while the rest of the record is still empty.
  scope?: readonly string[];
  // The committed README's generated block, and what the caller freshly
  // rendered for comparison (the renderer is a separate ticket; this
  // module never renders anything itself). Omit to skip the check.
  readme?: { committed: string; generated: string };
};

const issueReferencePattern = /^.*#\d+$/;

function isWellFormedIssueReference(value: unknown): value is string {
  return typeof value === 'string' && issueReferencePattern.test(value);
}

function nonEmpty(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

function inScope(name: string, scope: readonly string[] | undefined): boolean {
  return scope === undefined || scope.includes(name);
}

function declaredTypeSet(entry: CoverageEntry): ReadonlySet<RuleType> {
  return new Set(entry.declared.types);
}

function severityOfProfileEntry(
  entry: RulesConfiguration[string] | undefined,
): string | undefined {
  if (entry === undefined) {
    return undefined;
  }
  return typeof entry === 'string' ? entry : entry.severity;
}

export function checkCoverage(input: CoverageCheckInput): CoverageViolation[] {
  const { record, rules, profiles, scope, readme } = input;
  const violations: CoverageViolation[] = [];

  const scopedRules = rules.filter((rule) => inScope(rule.meta.name, scope));
  const scopedRuleNames = new Set(scopedRules.map((rule) => rule.meta.name));
  const scopedEntryNames = Object.keys(record.rules).filter((name) =>
    inScope(name, scope),
  );

  // Assertion: every loaded rule in scope has exactly one entry, and every
  // entry in scope names a loaded rule.
  for (const rule of scopedRules) {
    if (!(rule.meta.name in record.rules)) {
      violations.push({
        code: 'missing-entry',
        rule: rule.meta.name,
        message: `'${rule.meta.name}' is loaded but the coverage record has no entry for it.`,
      });
    }
  }
  for (const name of scopedEntryNames) {
    if (!scopedRuleNames.has(name)) {
      violations.push({
        code: 'orphaned-entry',
        rule: name,
        message: `The coverage record has an entry for '${name}', but no loaded rule carries that name.`,
      });
    }
  }

  for (const rule of scopedRules) {
    const entry = record.rules[rule.meta.name];
    if (entry === undefined) {
      continue;
    } // already reported as missing-entry

    // Assertion: every `covers` id is a declared unit.
    for (const unit of entry.covers) {
      if (!(unit in record.units)) {
        violations.push({
          code: 'unknown-unit',
          rule: rule.meta.name,
          unit: String(unit),
          message: `'${rule.meta.name}' covers unit '${String(unit)}', which the record does not declare.`,
        });
      }
    }

    // Assertion: the stamp is compared against the rule's live declared
    // types and severity; a mismatch names both sides. Runs for every
    // entry, informational included — `entry.declared.severity` is a free
    // field with no compile-time link to `rule.meta.severity`, so a rule
    // whose severity drifted after its informational entry was written
    // (e.g. `off` -> `warn`) needs this checked same as any other rule,
    // even though `declared.types` is fixed to `['informational']` by
    // #151's type and so can never itself drift.
    const declaredTypes = declaredTypeSet(entry);
    const liveTypes = new Set(rule.meta.type);
    const typesMatch =
      declaredTypes.size === liveTypes.size &&
      [...declaredTypes].every((type) => liveTypes.has(type));
    const severityMatches = entry.declared.severity === rule.meta.severity;
    if (!typesMatch || !severityMatches) {
      violations.push({
        code: 'stamp-mismatch',
        rule: rule.meta.name,
        message:
          `'${rule.meta.name}''s stamp says types [${entry.declared.types.join(', ')}] ` +
          `severity '${entry.declared.severity}'; the loaded rule says types ` +
          `[${rule.meta.type.join(', ')}] severity '${rule.meta.severity}'.`,
      });
    }

    // Assertion: an informational rule carries no cells — all three of its
    // cells are derived from its whole-rule reason (`rule.meta.impossibility`,
    // made authoritative by the executability gate), so a record cannot
    // state a second, possibly disagreeing claim about it here.
    if (rule.meta.type.includes('informational')) {
      if (entry.contexts !== undefined) {
        violations.push({
          code: 'informational-entry-has-cells',
          rule: rule.meta.name,
          message: `'${rule.meta.name}' is informational; its cells all come from its whole-rule reason, so the entry must not carry 'contexts'.`,
        });
      }
      continue; // nothing else applies to an informational entry
    }

    // Assertion: every context a rule does not declare carries a cell with
    // a reason and a note; a blank cell and an empty note are both
    // violations.
    for (const context of coverageContexts) {
      if (declaredTypes.has(context)) {
        continue;
      }
      const cell = entry.contexts?.[context];
      if (cell === undefined) {
        violations.push({
          code: 'undeclared-context-cell-invalid',
          rule: rule.meta.name,
          context,
          message: `'${rule.meta.name}' does not declare '${context}' and carries no cell explaining why.`,
        });
      } else if (typeof cell === 'string') {
        violations.push({
          code: 'undeclared-context-cell-invalid',
          rule: rule.meta.name,
          context,
          message: `'${rule.meta.name}' does not declare '${context}', but its cell is the bare literal '${cell}' rather than an impossible cell with a reason and a note.`,
        });
      } else if (!nonEmpty(cell.note)) {
        violations.push({
          code: 'undeclared-context-cell-invalid',
          rule: rule.meta.name,
          context,
          message: `'${rule.meta.name}''s cell for '${context}' has an empty note.`,
        });
      } else if (
        cell.reason === 'tool-limitation' &&
        !isWellFormedIssueReference(cell.issue)
      ) {
        // Assertion: every tool-limitation cell carries a well-formed
        // issue reference.
        violations.push({
          code: 'malformed-tool-limitation-issue',
          rule: rule.meta.name,
          context,
          message: `'${rule.meta.name}''s tool-limitation cell for '${context}' carries a malformed issue reference: ${JSON.stringify(cell.issue)}.`,
        });
      }
    }

    // Assertion: an error-severity rule in a package whose source declares
    // no keyword basis must carry a cited source. When a source counts no
    // per-statement BCP 14 keyword (Cookies' producer/consumer split,
    // Fetch's zero-keyword CORS surface, RFC 9110 §17's section
    // substitute), nothing backs an `error` severity on its own, so the
    // rule needs its own `.url()`. Read off `record.source.hasKeywordBasis`
    // — a declared fact, not derived from `countingRule`'s prose, which is
    // written for a human reader and cannot be trusted for this (a real
    // keyword-based source can describe its counting rule without the word
    // "keyword" at all, and vice versa).
    if (
      !record.source.hasKeywordBasis &&
      rule.meta.severity === 'error' &&
      !nonEmpty(rule.meta.url)
    ) {
      violations.push({
        code: 'uncited-error-severity-rule',
        rule: rule.meta.name,
        message: `'${rule.meta.name}' is 'error' severity in a package whose source declares no keyword basis, and carries no cited source ('.url()').`,
      });
    }

    // Assertion: a rule promoted by a shipped profile carries a concern
    // tag, is not marked heuristic in any declared context, and has a
    // non-empty explanation. "Promoted" means a convention rule (shipping
    // `off` by default) that a profile's own config turns on — an
    // already-enforced rule needs no second check here.
    if (rule.meta.severity === 'off' && profiles !== undefined) {
      for (const [profileName, config] of Object.entries(profiles)) {
        const promotedSeverity = severityOfProfileEntry(config[rule.meta.name]);
        if (promotedSeverity === undefined || promotedSeverity === 'off') {
          continue;
        }

        const missing: string[] = [];
        if (!rule.meta.tags || rule.meta.tags.length === 0) {
          missing.push('a concern tag');
        }
        const heuristicContext = [...declaredTypes].find(
          (context) =>
            entry.contexts?.[context as CoverageContext] === 'heuristic',
        );
        if (heuristicContext !== undefined) {
          missing.push(`not marked heuristic in '${heuristicContext}'`);
        }
        if (!nonEmpty(rule.meta.explanation)) {
          missing.push('a non-empty explanation');
        }

        if (missing.length > 0) {
          violations.push({
            code: 'undocumented-promoted-rule',
            rule: rule.meta.name,
            message: `'${rule.meta.name}' is promoted to '${promotedSeverity}' by profile '${profileName}' but is missing: ${missing.join(', ')}.`,
          });
        }
      }
    }
  }

  // Assertion: with a committed README supplied, the generated block is
  // compared against it.
  if (readme !== undefined && readme.committed !== readme.generated) {
    violations.push({
      code: 'readme-drift',
      message:
        "The committed README's generated block does not match what the package renders today.",
    });
  }

  return violations;
}
