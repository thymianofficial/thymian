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

export default class Analyze extends BaseCliRunCommand<typeof Analyze> {
  static override description =
    'Analyze recorded API traffic against specifications and configured rule sets.';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --traffic har:./traffic.har',
    '<%= config.bin %> <%= command.id %> --spec openapi:./openapi.yaml --traffic har:./traffic.har',
  ];

  static override requiresSpecifications = false;
  static override requiresTraffic = true;

  override async run(): Promise<void> {
    const specifications = this.thymianConfig.specifications ?? [];
    const traffic = this.thymianConfig.traffic ?? [];

    const ruleSets = mergeRuleSets(
      this.thymianConfig.ruleSets,
      this.flags['rule-set'],
    );

    const ruleSeverity = resolveRuleSeverity(
      this.thymianConfig.ruleSeverity,
      this.flags['rule-severity'],
    );

    const outcome = await this.thymian.run(async () => {
      return await this.thymian.analyze({
        specification: specifications.length > 0 ? specifications : undefined,
        traffic,
        rules: ruleSets,
        rulesConfig: this.thymianConfig.rules,
        ruleFilter: createSeverityRuleFilter(ruleSeverity),
      });
    });

    handleWorkflowOutcome(this, outcome);
  }
}
