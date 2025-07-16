import {
  isNodeType,
  type Logger,
  ThymianBaseError,
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
import { StaticApiContext } from '../api-context/static-api-context.js';
import type { Rule } from '../rule/rule.js';
import type { RuleMeta, RuleType } from '../rule/rule-meta.js';
import type { RuleSeverity } from '../rule/rule-severity.js';
import type { RuleViolation } from '../rule/rule-violation.js';

export function severityToColor(severity: RuleSeverity): string {
  if (severity === 'hint') {
    return chalk.blue(severity);
  } else if (severity === 'warn') {
    return chalk.yellow(severity);
  } else {
    return chalk.red(severity);
  }
}

export function requestToTitle(req: ThymianHttpRequest): string {
  const title = `${req.method.toUpperCase()} ${req.path}`;

  return req.mediaType ? title + ` - ${req.mediaType}` : title;
}

export function responseToTitle(res: ThymianHttpResponse): string {
  const statusCode = res.statusCode;
  const phrase = isValidHttpStatusCode(statusCode)
    ? httpStatusCodeToPhrase[statusCode]
    : 'Invalid status code';

  const title = `${statusCode} ${phrase.toUpperCase()}`;

  return res.mediaType ? title + ` - ${res.mediaType}` : title;
}

export function transactionToTitle(
  req: ThymianHttpRequest,
  res: ThymianHttpResponse
): string {
  return `${requestToTitle(req)} \u2192 ${responseToTitle(res)}`;
}

export class Linter {
  constructor(
    private readonly logger: Logger,
    private readonly rules: Rule[],
    private readonly report: (report: ThymianReport) => void,
    private readonly context: HttpTestContext,
    private readonly format: ThymianFormat,
    private readonly ruleOptions: Record<string, unknown>
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
      new StaticApiContext(this.format),
      {
        ...(this.ruleOptions[rule.meta.name] ?? {}),
        mode: 'static',
      },
      this.logger.child(rule.meta.name)
    );

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return true;
    }

    this.reportRuleViolations(result, rule.meta, 'Static Checks');

    return false;
  }

  protected async runTestRule(rule: Rule): Promise<boolean> {
    if (!rule.testRule) {
      return true;
    }

    const result = await rule.testRule(
      new HttpTestApiContext(rule.meta.name, this.context),
      { ...(this.ruleOptions[rule.meta.name] ?? {}), mode: 'test' },
      this.logger.child(rule.meta.name)
    );

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return true;
    }

    this.reportRuleViolations(result, rule.meta, 'HTTP Tests');

    return false;
  }

  private reportRuleViolations(
    result: RuleViolation | RuleViolation[],
    ruleMeta: RuleMeta<Record<PropertyKey, unknown>>,
    subTopic: string
  ) {
    const violations = Array.isArray(result) ? result : [result];

    for (const { location, message } of violations) {
      const topic = '@thymian/http-linter';
      let text = message ?? ruleMeta.summary ?? ruleMeta.description;
      text =
        `${severityToColor(ruleMeta.severity)}: ` +
        (text ? `${text}   ${chalk.dim(ruleMeta.name)}` : ruleMeta.name);
      let title = '';

      if (location.elementType === 'node') {
        const node = this.format.getNode(location.elementId);

        if (!node) {
          throw new ThymianBaseError(
            `Invalid rule violation location for rule ${ruleMeta.name}.`
          );
        }

        if (isNodeType(node, 'http-request')) {
          title = requestToTitle(node);
        } else if (isNodeType(node, 'http-response')) {
          title = responseToTitle(node);
        }
      } else {
        const [source, target] = this.format.graph.extremities(
          location.elementId
        );

        const req = this.format.getNode<ThymianHttpRequest>(source);
        const res = this.format.getNode<ThymianHttpResponse>(target);

        if (!req || !res) {
          throw new ThymianBaseError(
            `Invalid rule violation location for rule ${ruleMeta.name}.`
          );
        }

        title = transactionToTitle(req, res);
      }

      this.report({
        subTopic,
        text,
        title,
        topic,
        isProblem: true,
      });
    }
  }
}
