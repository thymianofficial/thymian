// The coverage renderer: turns a coverage record plus the rules it
// describes into the five README sections ADR-0021 §5 fixes — the
// headline, the severity map, the conventions table, the rule-verdict
// tables, and tag status, in that order. A pure function with no file
// access: the order is the argument, so a reader who stops after the
// headline has still read the honest part, and everything below it is
// evidence for the claim the headline already made.
//
// The generator (a later ticket) is what writes this between the
// HEADER/FOOTER markers inside a package's real README.md; this module
// never touches a filesystem and knows nothing about markers.

import type { Rule } from './rule.js';
import type { CoverageContext, CoverageRecord } from './rule-coverage.js';
import { coverageContexts } from './rule-coverage.js';
import type { RuleSeverity } from './rule-severity.js';
import {
  type RuleTag,
  type RuleTagCategory,
  ruleTagVocabulary,
} from './rule-tags.js';

export type CoverageRenderInput = {
  record: CoverageRecord;
  // Every rule the package ships at baseline (no profile/user config
  // applied), keyed by topic directory — e.g. `{ 'status-codes': [...],
  // routing: [...] }`. The renderer never infers a rule's topic itself
  // (nothing on `Rule`/`RuleMeta` carries one); the caller already knows
  // it, from the directory it globbed the rule out of.
  rulesByTopic: Record<string, readonly Rule[]>;
  // Every shipped profile's own loaded rule set — the caller runs
  // `loadRules(..., { profile })` once per name in the package's own
  // `RuleSet.profiles` and hands each result here, because only that real
  // load resolves a profile entry that overrides only `type`/`options` and
  // leaves severity at baseline. The severity map is the only section that
  // reads this; nothing else varies by profile (rule-verdicts is
  // profile-independent by construction — see below).
  profiles: Record<string, readonly Rule[]>;
};

function allRules(rulesByTopic: Record<string, readonly Rule[]>): Rule[] {
  return Object.values(rulesByTopic).flat();
}

// The BCP 14 keyword each Thymian severity renders as. Fixed workspace-wide
// (`.github/skills/add-http-rule-set/reference/executability-gate.md`: "a
// `MAY` is checkable at `hint`"), not derived per package — a source's own
// prose is `CoverageSource.countingRule`, written for a different purpose
// (see #151/#152's `hasKeywordBasis` history for why that field can't be
// parsed for a structured fact).
const severityKeyword: Record<RuleSeverity, string> = {
  error: 'MUST',
  warn: 'SHOULD',
  hint: 'MAY',
  off: '(off)',
};

function renderHeadline(
  record: CoverageRecord,
  rules: readonly Rule[],
): string {
  const unitIds = Object.keys(record.units);
  const covered = new Set<string>();
  let coveringRuleCount = 0;
  for (const rule of rules) {
    const entry = record.rules[rule.meta.name];
    if (entry === undefined || entry.covers.length === 0) {
      continue;
    }
    coveringRuleCount += 1;
    for (const unit of entry.covers) {
      covered.add(String(unit));
    }
  }

  const lines = ['## Coverage', ''];
  if (unitIds.length === 0) {
    // No denominator: never a reason to refuse the package (ADR-0021 §5),
    // but rendering a bare rule count here would imply one — "N rules"
    // reads as "N of N", a ratio nobody asserted.
    lines.push(
      `No denominator declared for this source. ${rules.length} rule(s) ship without a computed coverage ratio.`,
    );
  } else {
    lines.push(
      `**${covered.size} of ${unitIds.length}** units covered, by **${coveringRuleCount}** rule(s).`,
    );
  }
  lines.push('');
  lines.push(`- Source: ${record.source.revision}`);
  lines.push(`- Counting rule: ${record.source.countingRule}`);
  if (record.source.substituteLabel !== undefined) {
    lines.push(`- Substitute: ${record.source.substituteLabel}`);
  }

  if (unitIds.length > 0) {
    const uncovered = unitIds.filter((id) => !covered.has(id));
    lines.push('');
    if (uncovered.length === 0) {
      lines.push('Not yet covered: none.');
    } else {
      lines.push('Not yet covered:');
      for (const id of uncovered) {
        lines.push(`- \`${id}\` — ${record.units[id]}`);
      }
    }
  }

  return lines.join('\n');
}

function renderSeverityMap(profiles: Record<string, readonly Rule[]>): string {
  const profileNames = Object.keys(profiles);
  const lines = ['## Severity map', ''];
  if (profileNames.length === 0) {
    lines.push('No shipped profiles.');
    return lines.join('\n');
  }

  const severities = Object.keys(severityKeyword) as RuleSeverity[];
  lines.push(`| Severity | Keyword | ${profileNames.join(' | ')} |`);
  lines.push(`| --- | --- | ${profileNames.map(() => '---').join(' | ')} |`);
  for (const severity of severities) {
    const counts = profileNames.map((name) => {
      const rules = profiles[name] ?? [];
      return rules.filter((rule) => rule.meta.severity === severity).length;
    });
    lines.push(
      `| ${severity} | ${severityKeyword[severity]} | ${counts.join(' | ')} |`,
    );
  }
  return lines.join('\n');
}

function renderConventions(rules: readonly Rule[]): string {
  const conventions = rules.filter(
    (rule) =>
      rule.meta.severity === 'off' && !rule.meta.type.includes('informational'),
  );
  const lines = ['## Conventions', ''];
  if (conventions.length === 0) {
    lines.push('None.');
    return lines.join('\n');
  }
  for (const rule of conventions) {
    lines.push(`### ${rule.meta.name}`);
    lines.push('');
    lines.push(rule.meta.explanation ?? '');
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

// A declared context defaults to 'observable'; only a 'heuristic' cell
// ever overrides that for one the rule *does* declare. Rendered with a
// distinct marker from plain observability, per the acceptance criterion.
function cellSymbol(
  record: CoverageRecord,
  rule: Rule,
  context: CoverageContext,
): string {
  if (rule.meta.type.includes('informational')) {
    // Derived from the whole-rule reason, never from the record — #151/
    // #152 both refuse a record that tries to state a second claim here.
    const reason = rule.meta.impossibility?.reason ?? 'unknown';
    return `impossible (${reason})`;
  }

  const entry = record.rules[rule.meta.name];
  const declared = new Set(entry?.declared.types ?? []);
  if (declared.has(context)) {
    const cell = entry?.contexts?.[context];
    return cell === 'heuristic' ? '~heuristic~' : 'observable';
  }

  const cell = entry?.contexts?.[context];
  if (cell === undefined || typeof cell === 'string') {
    return 'impossible';
  }
  return `impossible (${cell.reason})`;
}

function renderRuleVerdicts(
  record: CoverageRecord,
  rulesByTopic: Record<string, readonly Rule[]>,
): string {
  const lines = ['## Rule verdicts', ''];
  const topics = Object.keys(rulesByTopic);
  if (topics.length === 0) {
    lines.push('No rules.');
    return lines.join('\n');
  }

  for (const topic of topics) {
    const rules = rulesByTopic[topic] ?? [];
    lines.push(`### ${topic}`);
    lines.push('');
    lines.push(`| Rule | ${coverageContexts.join(' | ')} |`);
    lines.push(`| --- | ${coverageContexts.map(() => '---').join(' | ')} |`);
    for (const rule of rules) {
      const cells = coverageContexts.map((context) =>
        cellSymbol(record, rule, context),
      );
      lines.push(`| ${rule.meta.name} | ${cells.join(' | ')} |`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function renderTagStatus(rules: readonly Rule[]): string {
  // Every category in the closed, workspace-wide vocabulary, every time —
  // not only the ones this package's rules touch. "Ships empty" has to
  // include the category the package never contributes a single tag to, or
  // a reader can't tell "deliberately covers none of this" from "nobody
  // looked" — the same distinction `countingRule`/`hasKeywordBasis` draws
  // for a source's denominator (#151/#152).
  const lines = ['## Tag status', ''];
  for (const category of Object.keys(ruleTagVocabulary) as RuleTagCategory[]) {
    lines.push(`### ${category}`);
    lines.push('');
    for (const member of ruleTagVocabulary[category]) {
      const tag = `${category}:${member}` as RuleTag;
      const count = rules.filter((rule) =>
        rule.meta.tags?.includes(tag),
      ).length;
      lines.push(
        count > 0
          ? `- \`${tag}\` — ${count} rule(s)`
          : `- \`${tag}\` — ships empty`,
      );
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

export function renderCoverage(input: CoverageRenderInput): string {
  const rules = allRules(input.rulesByTopic);
  return [
    renderHeadline(input.record, rules),
    renderSeverityMap(input.profiles),
    renderConventions(rules),
    renderRuleVerdicts(input.record, input.rulesByTopic),
    renderTagStatus(rules),
  ].join('\n\n');
}
