import {
  BaseCliRunCommand,
  createSeverityRuleFilter,
  mergeRuleSets,
  mergeSpecifications,
  resolveRuleSeverity,
} from '@thymian/cli-common';
import type {} from '@thymian/evaluation';
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
    const specifications = mergeSpecifications(
      this.thymianConfig.specifications,
      this.flags.spec,
    );

    if (specifications.length === 0) {
      this.logger.warn(
        'No specifications configured. Add specifications to your config file or use --spec flags.',
      );
    }

    const ruleSets = mergeRuleSets(
      this.thymianConfig.ruleSets,
      this.flags['rule-set'],
    );

    const ruleSeverity = resolveRuleSeverity(
      this.thymianConfig.ruleSeverity,
      this.flags['rule-severity'],
    );

    const results = await this.thymian.run(async (emitter) => {
      const validationResults = await this.thymian.lint({
        specification: specifications,
        rules: ruleSets,
        rulesConfig: this.thymianConfig.rules,
        ruleFilter: createSeverityRuleFilter(ruleSeverity),
      });

      const [flushResult] = await emitter.emitAction(
        'core.report.flush',
        undefined,
        { strategy: 'collect' },
      );

      if (flushResult?.text) {
        this.log(flushResult.text);
      }

      return validationResults;
    });

    const hasError = results.some((r) => r.status === 'error');

    if (hasError) {
      this.exit(2);
    }

    const hasFailed = results.some((r) => r.status === 'failed');

    if (hasFailed) {
      this.exit(1);
    }
  }
}
