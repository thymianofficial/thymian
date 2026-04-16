import {
  BaseCliRunCommand,
  createSeverityRuleFilter,
  handleWorkflowOutcome,
  mergeRuleSets,
  resolveRuleSeverity,
} from '@thymian/common-cli';
import { Flags } from '@thymian/common-cli/oclif';
import type {} from '@thymian/plugin-openapi';
import type {} from '@thymian/plugin-reporter';
import type {} from '@thymian/plugin-sampler';
import type {} from '@thymian/plugin-websocket-proxy';

export default class Test extends BaseCliRunCommand<typeof Test> {
  static override description =
    'Test API specifications by running live requests against configured rule sets.';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --spec openapi:./openapi.yaml',
    '<%= config.bin %> <%= command.id %> --rule-set @thymian/rules-rfc-9110',
    '<%= config.bin %> <%= command.id %> --target-url http://localhost:8080',
  ];

  static override flags = {
    ['target-url']: Flags.string({
      description:
        'Override the target URL for all test requests. When set, all requests are sent to this origin instead of the servers defined in the specification.',
    }),
  };

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

    const targetUrl = this.flags['target-url'] ?? this.thymianConfig.targetUrl;

    const outcome = await this.thymian.run(async () => {
      return await this.thymian.test({
        specification: specifications,
        rules: ruleSets,
        rulesConfig: this.thymianConfig.rules,
        ruleFilter: createSeverityRuleFilter(ruleSeverity),
        targetUrl,
        skipSpecValidation: this.flags['skip-spec-validation'],
      });
    });

    handleWorkflowOutcome(this, outcome);
  }
}
