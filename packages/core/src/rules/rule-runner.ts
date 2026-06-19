import type {
  HttpTransaction,
  ThymianHttpRequest,
  ThymianHttpResponse,
} from '../format/index.js';
import { isNodeType, ThymianFormat } from '../format/index.js';
import type { Logger } from '../logger/logger.js';
import type { Location } from '../report/index.js';
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
import type { RuleSeverity } from './rule-severity.js';
import { isRuleSeverityLevel } from './rule-severity.js';
import type {
  EvaluatedRuleViolation,
  RuleFnResult,
  RuleViolationLocation,
} from './rule-violation.js';

export function findDuplicates<T>(elements: T[]): T[] {
  return elements.filter(
    (element, index) => elements.indexOf(element) !== index,
  );
}

export function resolveViolationLocation(
  location: RuleViolationLocation,
  format: ThymianFormat,
  ruleName: string,
): { heading: string; location: Location } {
  if (typeof location === 'string') {
    return {
      heading: location,
      location: { type: 'custom', value: location },
    };
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

    let heading = location.label ?? '';

    if (isNodeType(node, 'http-request')) {
      heading = heading || thymianRequestToString(node);
    } else if (isNodeType(node, 'http-response')) {
      heading = heading || thymianResponseToString(node);
    }

    if (node.sourceLocation && 'path' in node.sourceLocation) {
      return {
        heading,
        location: {
          type: 'file',
          path: node.sourceLocation.path,
          line: node.sourceLocation.position?.line,
          column: node.sourceLocation.position?.column,
        },
      };
    }

    return {
      heading,
      location: {
        type: 'thymianFormat',
        elementType: 'node',
        elementId: location.elementId,
        pointer: location.pointer ?? '',
      },
    };
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

  const heading = location.label ?? thymianHttpTransactionToString(req, res);

  if (transaction.sourceLocation && 'path' in transaction.sourceLocation) {
    return {
      heading,
      location: {
        type: 'file',
        path: transaction.sourceLocation.path,
        line: transaction.sourceLocation.position?.line,
        column: transaction.sourceLocation.position?.column,
      },
    };
  }

  return {
    heading,
    location: {
      type: 'thymianFormat',
      elementType: 'edge',
      elementId: location.elementId,
      pointer: location.pointer ?? '',
    },
  };
}

export function isRuleEnabled(rule: Rule): boolean {
  return (
    rule.meta.severity !== 'off' &&
    !(rule.meta.type.length === 1 && rule.meta.type[0] === 'informational')
  );
}

export interface RuleExecutionDiagnosticsProvider<TDiagnostics = unknown> {
  getRuleExecutionDiagnostics(): TDiagnostics | undefined;
}

export type RunRulesResult<TDiagnostics = unknown> = Record<
  string,
  {
    diagnostics: TDiagnostics | undefined;
    ruleFnResult: RuleFnResult[];
  }
>;

export type RuleRunnerAdapter<
  Context extends RuleExecutionDiagnosticsProvider<TDiagnostics>,
  TDiagnostics = unknown,
> = {
  errorName: string;
  mode: 'static' | 'analytics' | 'test';
  getRuleFn(rule: Rule):
    | ((
        context: Context,
        options: Record<PropertyKey, unknown> & {
          mode: 'static' | 'analytics' | 'test';
        },
        logger: Logger,
      ) => RuleFnResult[] | Promise<RuleFnResult[]>)
    | undefined;
  createContext(
    rule: Rule,
    options: SingleRuleConfiguration | undefined,
  ): Context;
};

export function runRulesResultToViolations<TDiagnostics>(
  result: RunRulesResult<TDiagnostics>,
  rules: Rule[],
): EvaluatedRuleViolation[] {
  const ruleMap = new Map(rules.map((r) => [r.meta.name, r]));
  const violations: EvaluatedRuleViolation[] = [];

  for (const [ruleName, { ruleFnResult }] of Object.entries(result)) {
    const rule = ruleMap.get(ruleName);
    if (!rule) {
      continue;
    }

    for (const entry of ruleFnResult) {
      if (entry.violation === undefined) {
        continue;
      }
      violations.push({
        ruleName,
        severity: rule.meta.severity as Exclude<RuleSeverity, 'off'>,
        location: entry.location,
        message:
          entry.violation.message ||
          (rule.meta.summary ?? rule.meta.description ?? rule.meta.name),
      });
    }
  }

  return violations;
}

export async function runRules<
  Context extends RuleExecutionDiagnosticsProvider<TDiagnostics>,
  TDiagnostics = unknown,
>(
  logger: Logger,
  rules: Rule[],
  format: ThymianFormat,
  rulesConfig: RulesConfiguration,
  adapter: RuleRunnerAdapter<Context, TDiagnostics>,
): Promise<RunRulesResult<TDiagnostics>> {
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

  const filteredRules = rules.filter(isRuleEnabled);
  const result: RunRulesResult<TDiagnostics> = {};

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

      const ruleFnResult = await ruleFn(
        context,
        {
          ...((options ?? {}).options ?? {}),
          mode: adapter.mode,
        },
        logger.child(rule.meta.name),
      );

      const diagnostics = context.getRuleExecutionDiagnostics();

      result[rule.meta.name] = { diagnostics, ruleFnResult };
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

  return result;
}
