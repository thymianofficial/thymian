import { type Logger } from '@thymian/core';
import type { HttpTestContext } from '@thymian/http-testing';

import { HttpTestApiContext } from '../api-context/http-test-api-context.js';
import type { StaticApiContext } from '../api-context/static-api-context.js';
import type { Rule } from '../rule/rule.js';
import type { RuleType } from '../rule/rule-meta.js';
import type { RuleViolation } from '../rule/rule-violation.js';

export type HttpLintResult = {
  rule: string;
  violations: RuleViolation[];
};

export class Linter {
  constructor(
    private readonly logger: Logger,
    private readonly rules: Rule[],
    private readonly report: (result: HttpLintResult) => void,
    private readonly apiContext: StaticApiContext,
    private readonly context: HttpTestContext
  ) {}

  async run(modes: RuleType[]): Promise<boolean> {
    const lintStatic = modes.includes('static');
    const runTest = modes.includes('test');

    let valid = true;

    for (const rule of this.rules) {
      if (lintStatic && rule.staticRule) {
        valid = await this.runStaticRule(rule);
      }
      if (runTest && rule.testRule) {
        valid = await this.runTestRule(rule);
      }
    }

    return valid;
  }

  protected async runStaticRule(rule: Rule): Promise<boolean> {
    if (!rule.staticRule) {
      return true;
    }

    const result = await rule.staticRule(
      this.apiContext,
      {},
      this.logger.child(rule.meta.name)
    );

    if (!result) {
      return true;
    }

    this.report({
      rule: rule.meta.name,
      violations: Array.isArray(result) ? result : [result],
    });

    return false;
  }

  protected async runTestRule(rule: Rule): Promise<boolean> {
    if (!rule.testRule) {
      return true;
    }

    const result = await rule.testRule(
      new HttpTestApiContext(rule.meta.name, this.context),
      {},
      this.logger.child(rule.meta.name)
    );

    if (!result) {
      return true;
    }

    this.report({
      rule: rule.meta.name,
      violations: Array.isArray(result) ? result : [result],
    });

    return false;
  }
}
