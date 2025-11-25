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

import type { Rule } from '../rule/rule.js';
import type { RuleMeta } from '../rule/rule-meta.js';
import type { RuleViolation } from '../rule/rule-violation.js';

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
    >,
  ) {
    this.rules = rules.filter(
      (r) => !(r.meta.type.length === 1 && r.meta.type[0] === 'informational'),
    );
  }

  async run(): Promise<boolean> {
    return (
      await Promise.all(
        this.rules.map(async (rule) => {
          try {
            return await this.runRule(
              rule,
              this.ruleOptions[rule.meta.name] ?? {},
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
                },
              );
            }
          }
        }),
      )
    ).every(Boolean);
  }

  protected abstract runRule<Options extends Record<string, unknown>>(
    rule: Rule,
    options: Options,
  ): Promise<boolean>;

  protected reportRuleViolations(
    result: RuleViolation | RuleViolation[],
    ruleMeta: RuleMeta<Record<PropertyKey, unknown>>,
    category = 'HTTP Conformance Violation',
  ): void {
    if (ruleMeta.severity === 'off') {
      return;
    }

    const violations = Array.isArray(result) ? result : [result];

    const producer = '@thymian/http-linter';
    const source = ruleMeta.name;
    const severity = ruleMeta.severity;
    const summary = ruleMeta.summary ?? ruleMeta.description ?? ruleMeta.name;
    const details = ruleMeta.description;
    const timestamp = Date.now();

    for (const { location, message } of violations) {
      const report: ThymianReport = {
        producer,
        severity,
        summary: message ?? summary,
        details,
        timestamp,
        source,
        category,
        title: '',
      };

      if (location.elementType === 'node') {
        const node = this.format.getNode(location.elementId);

        if (!node) {
          throw new ThymianBaseError(
            `Invalid rule violation location for rule ${ruleMeta.name}.`,
          );
        }

        if (isNodeType(node, 'http-request')) {
          report.title = thymianRequestToString(node);
        } else if (isNodeType(node, 'http-response')) {
          report.title = thymianResponseToString(node);
        }

        report.location ??= {};

        if (node.sourceLocation) {
          report.location.reference = {
            ...node.sourceLocation,
          };
        }

        report.location.format = {
          elementType: 'node',
          id: location.elementId,
        };
      } else {
        const [source, target] = this.format.graph.extremities(
          location.elementId,
        );
        const transaction = this.format.getEdge<HttpTransaction>(
          location.elementId,
        );
        const req = this.format.getNode<ThymianHttpRequest>(source);
        const res = this.format.getNode<ThymianHttpResponse>(target);

        if (!req || !res || !transaction) {
          throw new ThymianBaseError(
            `Invalid rule violation location for rule ${ruleMeta.name}.`,
          );
        }

        report.title = thymianHttpTransactionToString(req, res);

        report.location ??= {};

        if (transaction.sourceLocation) {
          report.location.reference = {
            ...transaction.sourceLocation,
          };
        }

        report.location.format = {
          elementType: 'edge',
          id: location.elementId,
        };
      }

      this.report(report);
    }
  }
}
