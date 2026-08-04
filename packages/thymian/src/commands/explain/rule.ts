import { EOL } from 'node:os';

import { BaseCliRunCommand, mergeRuleSets, oclif } from '@thymian/common-cli';
import { Args } from '@thymian/common-cli/oclif';
import {
  loadRules,
  type Rule,
  type RuleSeverity,
  SEVERITY_COLORS,
  SEVERITY_SYMBOLS,
} from '@thymian/core';

export default class ExplainRule extends BaseCliRunCommand<typeof ExplainRule> {
  static override description =
    'Explain a single rule: what it checks, why it matters, and how to act on it.';

  static override examples = [
    '<%= config.bin %> <%= command.id %> rfc9110/origin-server-should-send-501-response-for-unrecognized-method',
  ];

  // Read-only lookup: no specifications, traffic, or workflow execution required.
  static override requiresSpecifications = false;

  static override args = {
    ruleName: Args.string({
      required: true,
      description:
        'Canonical rule id, e.g. rfc9110/<rule-name> (as shown by `thymian rules list`).',
    }),
  };

  override async run(): Promise<void> {
    const ruleSets = mergeRuleSets(
      this.thymianConfig.ruleSets,
      this.flags['rule-set'],
    );

    // `explain` is a threshold-independent lookup: load every rule in the
    // configured rule sets — including disabled (`off`) ones — so any rule the
    // user names can be explained regardless of the active severity threshold.
    // (Unlike `rules list`, whose purpose is to show what is currently active.)
    const rules = await loadRules(
      ruleSets,
      () => true,
      this.thymianConfig.rules,
      this.flags.cwd,
    );

    if (rules.length === 0) {
      this.error(
        'No rules are loaded. Configure a rule set (e.g. `--rule-set @thymian/rules-rfc-9110`) or add one to your Thymian config.',
      );
    }

    // Canonical lookup keyed by the stable `<ruleset>/<name>` id that reports use.
    const ruleMap = new Map(rules.map((rule) => [rule.meta.name, rule]));
    const rule = ruleMap.get(this.args.ruleName);

    if (!rule) {
      this.error(
        `Unknown rule "${this.args.ruleName}". Run \`thymian rules list\` to see the available rules.`,
      );
    }

    this.log(formatRuleDetail(rule).join(EOL));
  }
}

/**
 * Render focused, educational detail for a single rule. Optional fields are
 * omitted entirely when absent — no empty headings or placeholders. Field order
 * follows UX Decision 11: id → summary → description → "Why this matters"
 * (explanation) → "Recommendation" → Severity → Applies to → Reference.
 *
 * Content is identical across TTY and non-TTY; only color (stripped by
 * `oclif.ux.colorize` when the stream is not a TTY) differs. Unicode severity
 * symbols are always preserved.
 */
function formatRuleDetail(rule: Rule): string[] {
  const {
    name,
    summary,
    description,
    explanation,
    recommendation,
    severity,
    appliesTo,
    url,
  } = rule.meta;

  const lines: string[] = [];

  // Each section is a blank spacer + bold heading + value. Optional fields are
  // pushed only when present, so absent fields leave no empty heading (AC3).
  const section = (heading: string, value: string): void => {
    lines.push('', oclif.ux.colorize('bold', heading), value);
  };

  section('RULE', name);

  if (summary) {
    section('SUMMARY', summary);
  }

  if (description) {
    section('DESCRIPTION', description);
  }

  if (explanation) {
    section('EXPLANATION', explanation);
  }

  if (recommendation) {
    section('RECOMMENDATION', recommendation);
  }

  section('SEVERITY', formatSeverity(severity));

  if (appliesTo && appliesTo.length > 0) {
    section('APPLIES TO', appliesTo.join(', '));
  }

  if (url) {
    section('REFERENCE', url);
  }

  return lines;
}

/**
 * Colorized `<symbol> <severity>` label, mirroring the report renderer
 * (`render/status.ts`). `off` has no report symbol/color, so it is dimmed like
 * the sibling `rules list` command.
 */
function formatSeverity(severity: RuleSeverity): string {
  if (severity === 'off') {
    return oclif.ux.colorize('dim', severity);
  }

  return oclif.ux.colorize(
    SEVERITY_COLORS[severity],
    `${SEVERITY_SYMBOLS[severity]} ${severity}`,
  );
}
