import {
  type Logger,
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
  type ThymianReport,
} from '@thymian/core';
import {
  httpStatusCodeToPhrase,
  isValidHttpStatusCode,
} from '@thymian/http-status-codes';
import type { HttpTestContext } from '@thymian/http-testing';
import chalk from 'chalk';

import { HttpTestApiContext } from '../api-context/http-test-api-context.js';
import type { StaticApiContext } from '../api-context/static-api-context.js';
import type { Rule } from '../rule/rule.js';
import type { RuleType } from '../rule/rule-meta.js';
import type { RuleSeverity } from '../rule/rule-severity.js';
import type { RuleViolation } from '../rule/rule-violation.js';

export type HttpLintResult = {
  rule: string;
  violations: RuleViolation[];
};

export function severityToColor(severity: RuleSeverity): string {
  if (severity === 'hint') {
    return chalk.blue(severity);
  } else if (severity === 'warn') {
    return chalk.yellow(severity);
  } else {
    return chalk.red(severity);
  }
}

export function transactionToTitle(
  req: ThymianHttpRequest,
  res: ThymianHttpResponse
): string {
  const statusCode = res.statusCode;
  const phrase = isValidHttpStatusCode(statusCode)
    ? httpStatusCodeToPhrase[statusCode]
    : 'Invalid status code';

  let title = `${req.method.toUpperCase()} ${req.path}`;

  if (req.mediaType) {
    title += ` - ${req.mediaType} `;
  }

  title += ` \u2192 ${res.statusCode} ${phrase.toUpperCase()}`;

  if (res.mediaType) {
    title += ` - ${res.mediaType}`;
  }

  return title;
}

export class Linter {
  constructor(
    private readonly logger: Logger,
    private readonly rules: Rule[],
    private readonly report: (report: ThymianReport) => void,
    private readonly apiContext: StaticApiContext,
    private readonly context: HttpTestContext,
    private readonly format: ThymianFormat
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
      { mode: 'static' },
      this.logger.child(rule.meta.name)
    );

    if (!result) {
      return true;
    }

    for (const { location, message } of Array.isArray(result)
      ? result
      : [result]) {
      if (location) {
        if (location.elementType === 'node') {
          const node = this.format.getNode(location.elementId);

          if (!node) {
            throw new Error('Wrong element id.');
          }
        } else {
          const source = this.format.graph.source(location.elementId);
          const target = this.format.graph.target(location.elementId);

          const req = this.format.getNode<ThymianHttpRequest>(source);
          const res = this.format.getNode<ThymianHttpResponse>(target);

          if (!req || !res) {
            throw new Error('Wrong element id.');
          }

          const topic = '@thymian/http-linter';
          const title = transactionToTitle(req, res);

          let text = message ?? rule.meta.summary ?? rule.meta.description;

          text =
            `${severityToColor(rule.meta.severity)}: ` +
            (text ? `${text}   ${chalk.dim(rule.meta.name)}` : rule.meta.name);

          this.report({
            subTopic: 'Static Checks',
            text,
            title,
            topic,
            isProblem: true,
          });
        }
      }
    }

    return false;
  }

  protected async runTestRule(rule: Rule): Promise<boolean> {
    if (!rule.testRule) {
      return true;
    }

    const result = await rule.testRule(
      new HttpTestApiContext(rule.meta.name, this.context),
      { mode: 'test' },
      this.logger.child(rule.meta.name)
    );
    if (!result) {
      return true;
    }

    for (const { location, message } of Array.isArray(result)
      ? result
      : [result]) {
      if (location) {
        if (location.elementType === 'node') {
          const node = this.format.getNode(location.elementId);

          if (!node) {
            throw new Error('Wrong element id.');
          }
        } else {
          const source = this.format.graph.source(location.elementId);
          const target = this.format.graph.target(location.elementId);

          const req = this.format.getNode<ThymianHttpRequest>(source);
          const res = this.format.getNode<ThymianHttpResponse>(target);

          if (!req || !res) {
            throw new Error('Wrong element id.');
          }

          const topic = '@thymian/http-linter';
          const title = transactionToTitle(req, res);

          let text = message ?? rule.meta.summary ?? rule.meta.description;

          text =
            `${severityToColor(rule.meta.severity)}: ` +
            (text ? `${text}   ${chalk.dim(rule.meta.name)}` : rule.meta.name);

          this.report({
            subTopic: 'HTTP Tests',
            text,
            title,
            topic,
            isProblem: true,
          });
        }
      }
    }

    return false;
  }
}
