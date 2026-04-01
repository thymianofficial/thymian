import type { ThymianReport } from '../events/report.event.js';
import type {
  HttpTransaction,
  ThymianHttpRequest,
  ThymianHttpResponse,
} from '../format/index.js';
import { isNodeType, ThymianFormat } from '../format/index.js';
import type { Logger } from '../logger/logger.js';
import { ThymianBaseError } from '../thymian.error.js';
import {
  thymianHttpTransactionToString,
  thymianRequestToString,
  thymianResponseToString,
} from '../utils.js';
import type { Rule } from './rule.js';
import type {
  RulesConfiguration,
  SingleRuleConfiguration,
} from './rule-configuration.js';
import type { RuleMeta } from './rule-meta.js';
import { isRuleSeverityLevel } from './rule-severity.js';
import type { RuleFnResult } from './rule-violation.js';
import type { RuleViolation } from './rule-violation.js';

export function findDuplicates<T>(elements: T[]): T[] {
  return elements.filter(
    (element, index) => elements.indexOf(element) !== index,
  );
}

export function reportRuleViolations(
  result: RuleViolation | RuleViolation[],
  ruleMeta: RuleMeta<Record<PropertyKey, unknown>>,
  format: ThymianFormat,
  violations: RuleViolation[],
  reportFn: (report: ThymianReport) => void,
  producer: string,
  category: string,
): void {
  if (ruleMeta.severity === 'off') {
    return;
  }

  const violationArray = Array.isArray(result) ? result : [result];

  const source = ruleMeta.name;
  const severity = ruleMeta.severity;
  const summary = ruleMeta.summary ?? ruleMeta.description ?? ruleMeta.name;
  const details = ruleMeta.description;
  const timestamp = Date.now();

  for (const { location, message } of violationArray) {
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

    if (typeof location === 'string') {
      report.title = location;
    } else {
      if (location.elementType === 'node') {
        const node = format.getNode(location.elementId);

        if (!node) {
          throw new ThymianBaseError(
            `Invalid rule violation location for rule ${ruleMeta.name}.`,
            {
              name: 'InvalidRuleViolationLocationError',
              ref: 'https://thymian.dev/references/errors/invalid-rule-violation-location-error/',
            },
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
        const [source, target] = format.graph.extremities(location.elementId);
        const transaction = format.getEdge<HttpTransaction>(location.elementId);
        const req = format.getNode<ThymianHttpRequest>(source);
        const res = format.getNode<ThymianHttpResponse>(target);

        if (!req || !res || !transaction) {
          throw new ThymianBaseError(
            `Invalid rule violation location for rule ${ruleMeta.name}.`,
            {
              name: 'InvalidRuleViolationLocationError',
              ref: 'https://thymian.dev/references/errors/invalid-rule-violation-location-error/',
            },
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
    }

    violations.push({
      rule: ruleMeta.name,
      severity,
      location,
      message,
      summary,
    });

    reportFn(report);
  }
}

export type RuleRunnerAdapter<Context> = {
  errorName: string;
  category: string;
  producer: string;
  mode: 'static' | 'analytics' | 'test';
  getRuleFn(rule: Rule):
    | ((
        context: Context,
        options: Record<PropertyKey, unknown> & {
          mode: 'static' | 'analytics' | 'test';
        },
        logger: Logger,
      ) => RuleFnResult | Promise<RuleFnResult>)
    | undefined;
  createContext(
    rule: Rule,
    options: SingleRuleConfiguration | undefined,
  ): Context;
};

export async function runRules<Context>(
  logger: Logger,
  rules: Rule[],
  reportFn: (report: ThymianReport) => void,
  format: ThymianFormat,
  rulesConfig: RulesConfiguration,
  adapter: RuleRunnerAdapter<Context>,
): Promise<{ valid: boolean; violations: RuleViolation[] }> {
  const duplicateRuleNames = findDuplicates(rules.map((r) => r.meta.name));

  if (duplicateRuleNames.length > 0) {
    throw new ThymianBaseError(
      `Duplicate rule names found: ${duplicateRuleNames.join(', ')}`,
      {
        name: 'DuplicateRuleNamesError',
        ref: 'https://thymian.dev/references/errors/duplicate-rule-names-error/',
      },
    );
  }

  const filteredRules = rules.filter(
    (r) =>
      r.meta.severity !== 'off' &&
      !(r.meta.type.length === 1 && r.meta.type[0] === 'informational'),
  );

  const violations: RuleViolation[] = [];
  let allSuccessful = true;

  for (const rule of filteredRules) {
    const options = isRuleSeverityLevel(rulesConfig[rule.meta.name])
      ? {}
      : (rulesConfig[rule.meta.name] as SingleRuleConfiguration | undefined);

    try {
      const ruleFn = adapter.getRuleFn(rule);

      if (!ruleFn) {
        continue;
      }

      const context = adapter.createContext(rule, options);

      const result = await ruleFn(
        context,
        {
          ...((options ?? {}).options ?? {}),
          mode: adapter.mode,
        },
        logger.child(rule.meta.name),
      );

      if (!result || (Array.isArray(result) && result.length === 0)) {
        continue;
      }

      reportRuleViolations(
        result,
        rule.meta,
        format,
        violations,
        reportFn,
        adapter.producer,
        adapter.category,
      );

      allSuccessful = false;
    } catch (e) {
      if (e instanceof ThymianBaseError) {
        throw new ThymianBaseError(
          `Error running rule ${rule.meta.name}: ${e.message}`,
          {
            name: adapter.errorName,
            cause: e,
          },
        );
      } else {
        throw new ThymianBaseError(
          `Error running rule ${rule.meta.name}: ${e}`,
          {
            name: adapter.errorName,
            cause: e,
          },
        );
      }
    }
  }

  return { valid: allSuccessful, violations };
}
