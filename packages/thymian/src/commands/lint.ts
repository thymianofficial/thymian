import {
  BaseCliRunCommand,
  createSeverityRuleFilter,
  handleWorkflowOutcome,
  mergeRuleSets,
  resolveRuleSeverity,
} from '@thymian/cli-common';
import type {} from '@thymian/openapi';
import type {} from '@thymian/reporter';
import type {} from '@thymian/sampler';
import type {} from '@thymian/websocket-proxy';

export default class Lint extends BaseCliRunCommand<typeof Lint> {
  static override description =
    'Lint API specifications against configured rule sets.';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --spec openapi:./openapi.yaml',
    '<%= config.bin %> <%= command.id %> --rule-set @thymian/rfc-9110-rules',
  ];

  override async run(): Promise<void> {
    const specifications = this.thymianConfig.specifications ?? [];

    const ruleSets = mergeRuleSets(
      this.thymianConfig.ruleSets,
      this.flags['rule-set'],
    );

    const ruleSeverity = resolveRuleSeverity(
      this.thymianConfig.ruleSeverity,
      this.flags['rule-severity'],
    );

    const outcome = await this.thymian.run(async () => {
      return await this.thymian.lint({
        specification: specifications,
        rules: ruleSets,
        rulesConfig: this.thymianConfig.rules,
        ruleFilter: createSeverityRuleFilter(ruleSeverity),
      });
    });

    handleWorkflowOutcome(this, outcome);
  }
}
