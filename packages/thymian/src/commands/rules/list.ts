import { EOL } from 'node:os';

import {
  BaseCliRunCommand,
  createSeverityRuleFilter,
  mergeRuleSets,
  oclif,
  resolveRuleSeverity,
} from '@thymian/common-cli';
import { Flags } from '@thymian/common-cli/oclif';
import { loadRules, type Rule, type RuleType, ruleTypes } from '@thymian/core';

export default class ListRules extends BaseCliRunCommand<typeof ListRules> {
  static override description = 'List all rules from the configured rule sets.';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --rule-set @thymian/rules-rfc-9110',
    '<%= config.bin %> <%= command.id %> --rule-severity hint',
    '<%= config.bin %> <%= command.id %> --type static',
  ];

  static override requiresSpecifications = false;

  static override flags = {
    type: Flags.string({
      description:
        'Filter rules by type (static, analytics, test, informational). Can be specified multiple times.',
      multiple: true,
      options: [...ruleTypes],
    }),
  };

  override async run(): Promise<void> {
    const ruleSets = mergeRuleSets(
      this.thymianConfig.ruleSets,
      this.flags['rule-set'],
    );

    const ruleSeverity = resolveRuleSeverity(
      this.thymianConfig.ruleSeverity,
      this.flags['rule-severity'],
    );

    const rules = await loadRules(
      ruleSets,
      createSeverityRuleFilter(ruleSeverity),
      this.thymianConfig.rules,
      this.flags.cwd,
    );

    const typeFilter = this.flags.type as RuleType[] | undefined;
    const filtered = typeFilter?.length
      ? rules.filter((rule) =>
          rule.meta.type.some((t) => typeFilter.includes(t)),
        )
      : rules;

    if (filtered.length === 0) {
      this.log('No rules found.');
      return;
    }

    const sorted = filtered.sort((a, b) =>
      a.meta.name.localeCompare(b.meta.name),
    );

    const topicColor = this.config?.theme?.topic;
    const lines = sorted.map((rule) => formatRule(rule, topicColor));

    this.log(lines.join(EOL));
    this.log();
    this.log(`${sorted.length} rule(s) loaded.`);
  }
}

function formatRule(rule: Rule, topicColor?: string): string {
  const { name, severity, type, summary } = rule.meta;

  const coloredName = oclif.ux.colorize(topicColor, name);
  const coloredSeverity = colorizeSeverity(severity);
  const types = type.join(', ');

  const parts = [`  ${coloredName}`, `[${coloredSeverity}]`, `(${types})`];

  if (summary) {
    parts.push(`- ${summary}`);
  }

  return parts.join('  ');
}

function colorizeSeverity(severity: string): string {
  switch (severity) {
    case 'error':
      return oclif.ux.colorize('red', severity);
    case 'warn':
      return oclif.ux.colorize('yellow', severity);
    case 'hint':
      return oclif.ux.colorize('cyan', severity);
    case 'off':
      return oclif.ux.colorize('dim', severity);
    default:
      return severity;
  }
}
