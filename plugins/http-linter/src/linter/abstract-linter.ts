import {
  type HttpTransaction,
  isNodeType,
  type Logger,
  ThymianBaseError,
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
  thymianHttpTransactionToString,
  type ThymianReport,
  thymianRequestToString,
  thymianResponseToString,
} from '@thymian/core';
import chalk from 'chalk';

import type { Rule } from '../rule/rule.js';
import type { RuleMeta } from '../rule/rule-meta.js';
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

export abstract class AbstractLinter {
  protected readonly rules: Rule[];

  constructor(
    protected readonly logger: Logger,
    rules: Rule[],
    protected readonly report: (report: ThymianReport) => void,
    protected readonly format: ThymianFormat,
    protected readonly ruleOptions: Record<
      string,
      Record<string, unknown> | undefined
    >
  ) {
    this.rules = rules.filter(
      (r) => !(r.meta.type.length === 1 && r.meta.type[0] === 'informational')
    );
  }

  async run(): Promise<boolean> {
    return (
      await Promise.all(
        this.rules.map(async (rule) => {
          try {
            return await this.runRule(
              rule,
              this.ruleOptions[rule.meta.name] ?? {}
            );
          } catch (e) {
            if (e instanceof ThymianBaseError) {
              throw e;
            } else {
              throw new ThymianBaseError(
                `Error running rule ${rule.meta.name}: ${e}`,
                {
                  name: `${this.constructor.name}Error`,
                  cause: e,
                }
              );
            }
          }
        })
      )
    ).every(Boolean);
  }

  protected abstract runRule<Options extends Record<string, unknown>>(
    rule: Rule,
    options: Options
  ): Promise<boolean>;

  protected reportRuleViolations(
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
        (text ? `${text}\n   ${chalk.dim(ruleMeta.name)}` : ruleMeta.name);
      let title = '';

      if (location.elementType === 'node') {
        const node = this.format.getNode(location.elementId);

        if (!node) {
          throw new ThymianBaseError(
            `Invalid rule violation location for rule ${ruleMeta.name}.`
          );
        }

        if (isNodeType(node, 'http-request')) {
          title = thymianRequestToString(node);
        } else if (isNodeType(node, 'http-response')) {
          title = thymianResponseToString(node);
        }
      } else {
        const [source, target] = this.format.graph.extremities(
          location.elementId
        );
        const transaction = this.format.getEdge<HttpTransaction>(
          location.elementId
        );
        const req = this.format.getNode<ThymianHttpRequest>(source);
        const res = this.format.getNode<ThymianHttpResponse>(target);

        if (!req || !res || !transaction) {
          throw new ThymianBaseError(
            `Invalid rule violation location for rule ${ruleMeta.name}.`
          );
        }

        title = thymianHttpTransactionToString(req, res);

        const report: ThymianReport = {
          subTopic,
          text,
          title,
          topic,
          isProblem: true,
          location: {
            format: {
              elementType: 'edge',
              id: location.elementId,
            },
          },
        };

        if (
          hasProperty(transaction, 'extensions') &&
          hasProperty(transaction.extensions, 'openapi')
        ) {
          const { location } = transaction.extensions.openapi;

          if (location && typeof location === 'string' && report.location) {
            report.location.file = location;
          }
        }

        this.report(report);
      }
    }
  }
}

export function hasProperty<T extends object, K extends PropertyKey>(
  obj: T,
  property: K
): obj is T & Record<K, Record<PropertyKey, unknown>> {
  return property in obj;
}
