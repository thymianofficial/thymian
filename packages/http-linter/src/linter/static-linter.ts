import { StaticApiContext } from '../api-context/static-api-context.js';
import type { Rule } from '../rule/rule.js';
import type { SingleRuleConfiguration } from '../rule-configuration.js';
import { AbstractLinter } from './abstract-linter.js';

export class StaticLinter extends AbstractLinter {
  protected override async runRule(
    rule: Rule,
    options: SingleRuleConfiguration,
  ): Promise<boolean> {
    if (!rule.lintRule) {
      return true;
    }

    const result = await rule.lintRule(
      new StaticApiContext(
        this.format,
        this.logger,
        this.report,
        options.skipOrigins,
      ),
      {
        ...(options.options ?? {}),
        mode: 'static',
      },
      this.logger.child(rule.meta.name),
    );

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return true;
    }

    this.reportRuleViolations(result, rule.meta, 'Static Checks');

    return false;
  }
}
