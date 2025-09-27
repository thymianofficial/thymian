import { type Logger, ThymianFormat, type ThymianReport } from '@thymian/core';
import type { Rule } from 'src/rule/rule.js';

import { AnalyticsApiContext } from '../api-context/analytics-api-context/analytics-api-context.js';
import { HttpTransactionRepository } from '../db/http-transaction-repository.js';
import { AbstractLinter } from './abstract-linter.js';

export class AnalyticsLinter extends AbstractLinter {
  constructor(
    private readonly repository: HttpTransactionRepository,
    logger: Logger,
    rules: Rule[],
    report: (report: ThymianReport) => void,
    format: ThymianFormat,
    ruleOptions: Record<string, Record<string, unknown> | undefined>,
  ) {
    super(logger, rules, report, format, ruleOptions);
  }

  protected override async runRule<Options extends Record<string, unknown>>(
    rule: Rule,
    options: Options,
  ): Promise<boolean> {
    if (!rule.analyticsRule) {
      return true;
    }

    const result = await rule.analyticsRule(
      new AnalyticsApiContext(this.repository, this.logger, this.format),
      {
        ...options,
        mode: 'analytics',
      },
      this.logger.child(rule.meta.name),
    );

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return true;
    }

    this.reportRuleViolations(result, rule.meta, 'Analytic Checks');

    return false;
  }
}
