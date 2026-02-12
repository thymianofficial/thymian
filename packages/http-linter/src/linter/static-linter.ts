import type { Rule } from 'src/rule/rule.js';

import { StaticApiContext } from '../api-context/static-api-context.js';
import type { SingleRuleOptions } from '../index.js';
import { AbstractLinter } from './abstract-linter.js';

export class StaticLinter extends AbstractLinter {
  protected override async runRule(
    rule: Rule,
    options: SingleRuleOptions,
  ): Promise<boolean> {
    if (!rule.staticRule) {
      return true;
    }

    const result = await rule.staticRule(
      new StaticApiContext(
        this.format,
        this.logger,
        this.report,
        options.skipOrigins,
      ),
      {
        ...(options.options ?? {}),
        mode: 'test',
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
