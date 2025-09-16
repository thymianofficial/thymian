import { type Logger, ThymianFormat, type ThymianReport } from '@thymian/core';
import type { HttpTestContext } from '@thymian/http-testing';

import { HttpTestApiContext } from '../api-context/http-test-api-context.js';
import type { Rule } from '../rule/rule.js';
import { AbstractLinter } from './abstract-linter.js';

export class HttpTestLinter extends AbstractLinter {
  constructor(
    private readonly context: HttpTestContext,
    logger: Logger,
    rules: Rule[],
    report: (report: ThymianReport) => void,
    format: ThymianFormat,
    ruleOptions: Record<string, Record<string, unknown> | undefined>
  ) {
    super(logger, rules, report, format, ruleOptions);
  }

  protected override async runRule(
    rule: Rule,
    options: Record<string, unknown>
  ): Promise<boolean> {
    if (!rule.testRule) {
      return true;
    }

    const result = await rule.testRule(
      new HttpTestApiContext(rule.meta.name, this.context, this.report),
      {
        ...options,
        mode: 'test',
      },
      this.logger.child(rule.meta.name)
    );

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return true;
    }

    this.reportRuleViolations(result, rule.meta, 'HTTP Tests');

    return false;
  }
}
