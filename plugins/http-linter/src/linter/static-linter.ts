import type { Rule } from 'src/rule/rule.js';

import { StaticApiContext } from '../api-context/static-api-context.js';
import { AbstractLinter } from './abstract-linter.js';

export class StaticLinter extends AbstractLinter {
  protected override async runRule<Options extends Record<string, unknown>>(
    rule: Rule,
    options: Options
  ): Promise<boolean> {
    if (!rule.staticRule) {
      return true;
    }

    const result = await rule.staticRule(
      new StaticApiContext(this.format, this.logger, this.report),
      {
        ...options,
        mode: 'test',
      },
      this.logger.child(rule.meta.name)
    );

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return true;
    }

    this.reportRuleViolations(result, rule.meta, 'Static Checks');

    return false;
  }
}
