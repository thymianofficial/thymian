import type { ThymianReportLocation } from '../events/report.event.js';
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
import { isRuleSeverityLevel } from './rule-severity.js';
import type { EvaluatedRuleViolation, RuleFnResult } from './rule-violation.js';
import type { RuleViolation } from './rule-violation.js';

export function findDuplicates<T>(elements: T[]): T[] {
  return elements.filter(
    (element, index) => elements.indexOf(element) !== index,
  );
}

export function resolveViolationLocation(
  violation: RuleViolation,
  format: ThymianFormat,
  ruleName: string,
): { heading: string; location?: ThymianReportLocation } {
  const { location } = violation;

  if (typeof location === 'string') {
    return { heading: location };
  }

  if (location.elementType === 'node') {
    const node = format.getNode(location.elementId);

    if (!node) {
      throw new ThymianBaseError(
        `Invalid rule violation location for rule ${ruleName}.`,
        {
          name: 'InvalidRuleViolationLocationError',
          ref: 'https://thymian.dev/references/errors/invalid-rule-violation-location-error/',
        },
      );
    }

    let heading = '';

    if (isNodeType(node, 'http-request')) {
      heading = thymianRequestToString(node);
    } else if (isNodeType(node, 'http-response')) {
      heading = thymianResponseToString(node);
    }

    const reportLocation: ThymianReportLocation = {};

    if (node.sourceLocation) {
      reportLocation.file = { ...node.sourceLocation };
    }

    reportLocation.format = {
      elementType: 'node',
      elementId: location.elementId,
    };

    return { heading, location: reportLocation };
  }

  const [source, target] = format.graph.extremities(location.elementId);
  const transaction = format.getEdge<HttpTransaction>(location.elementId);
  const req = format.getNode<ThymianHttpRequest>(source);
  const res = format.getNode<ThymianHttpResponse>(target);

  if (!req || !res || !transaction) {
    throw new ThymianBaseError(
      `Invalid rule violation location for rule ${ruleName}.`,
      {
        name: 'InvalidRuleViolationLocationError',
        ref: 'https://thymian.dev/references/errors/invalid-rule-violation-location-error/',
      },
    );
  }

  const heading = thymianHttpTransactionToString(req, res);

  const reportLocation: ThymianReportLocation = {};

  if (transaction.sourceLocation) {
    reportLocation.file = { ...transaction.sourceLocation };
  }

  reportLocation.format = {
    elementType: 'edge',
    elementId: location.elementId,
  };

  return { heading, location: reportLocation };
}

export interface RuleRunnerStatistics {
  rulesRun: number;
  rulesWithViolations: number;
}

export interface RunRulesResult {
  violations: EvaluatedRuleViolation[];
  statistics: RuleRunnerStatistics;
}

export type RuleRunnerAdapter<Context> = {
  errorName: string;
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
  format: ThymianFormat,
  rulesConfig: RulesConfiguration,
  adapter: RuleRunnerAdapter<Context>,
): Promise<RunRulesResult> {
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

  const violations: EvaluatedRuleViolation[] = [];
  let rulesRun = 0;
  let rulesWithViolations = 0;

  for (const rule of filteredRules) {
    const options = isRuleSeverityLevel(rulesConfig[rule.meta.name])
      ? {}
      : (rulesConfig[rule.meta.name] as SingleRuleConfiguration | undefined);

    try {
      const ruleFn = adapter.getRuleFn(rule);

      if (!ruleFn) {
        continue;
      }

      rulesRun++;

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

      const violationArray = Array.isArray(result) ? result : [result];

      if (rule.meta.severity === 'off') {
        continue;
      }

      rulesWithViolations++;

      for (const violation of violationArray) {
        violations.push({
          ruleName: rule.meta.name,
          severity: rule.meta.severity,
          violation: {
            message:
              rule.meta.summary ?? rule.meta.description ?? rule.meta.name,
            ...violation,
          },
        });
      }
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

  return {
    violations,
    statistics: {
      rulesRun,
      rulesWithViolations,
    },
  };
}
