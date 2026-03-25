import {
  createRuleFilter,
  type HttpTransaction,
  isNodeType,
  isRuleSeverityLevel,
  loadRules,
  type Logger,
  type Rule,
  type RuleMeta,
  type RulesConfiguration,
  type RuleViolation,
  type SingleRuleConfiguration,
  ThymianBaseError,
  type ThymianEmitter,
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
  thymianHttpTransactionToString,
  type ThymianPlugin,
  type ThymianReport,
  thymianRequestToString,
  thymianResponseToString,
} from '@thymian/core';

import { createContext } from './create-context.js';
import { HttpTestApiContext } from './http-test-api-context.js';

export { createContext } from './create-context.js';
export { HttpTestApiContext } from './http-test-api-context.js';

export type HttpTesterPluginOptions = {
  ruleSets: string[];
  severity?: 'off' | 'error' | 'warn' | 'hint';
  rules?: RulesConfiguration;
};

function findDuplicates<T>(elements: T[]): T[] {
  return elements.filter(
    (element, index) => elements.indexOf(element) !== index,
  );
}

function reportRuleViolations(
  result: RuleViolation | RuleViolation[],
  ruleMeta: RuleMeta<Record<PropertyKey, unknown>>,
  format: ThymianFormat,
  violations: RuleViolation[],
  reportFn: (report: ThymianReport) => void,
  category = 'HTTP Tests',
): void {
  if (ruleMeta.severity === 'off') {
    return;
  }

  const violationArray = Array.isArray(result) ? result : [result];

  const producer = '@thymian/http-linter';
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

async function runTestLinter(
  logger: Logger,
  emitter: ThymianEmitter,
  rules: Rule[],
  reportFn: (report: ThymianReport) => void,
  format: ThymianFormat,
  rulesConfig: RulesConfiguration,
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
    (r) => !(r.meta.type.length === 1 && r.meta.type[0] === 'informational'),
  );

  const context = createContext(format, logger, emitter);
  const violations: RuleViolation[] = [];
  let allSuccessful = true;

  for (const rule of filteredRules) {
    const options = isRuleSeverityLevel(rulesConfig[rule.meta.name])
      ? {}
      : (rulesConfig[rule.meta.name] as SingleRuleConfiguration | undefined);

    try {
      if (!rule.testRule) {
        continue;
      }

      const result = await rule.testRule(
        new HttpTestApiContext(
          rule.meta.name,
          context,
          reportFn,
          (options ?? {}).skipOrigins,
        ),
        {
          ...((options ?? {}).options ?? {}),
          mode: 'test',
        },
        logger.child(rule.meta.name),
      );

      if (!result || (Array.isArray(result) && result.length === 0)) {
        logger.debug(`Rule ${rule.meta.name} finished with success: true`);
        continue;
      }

      reportRuleViolations(
        result,
        rule.meta,
        format,
        violations,
        reportFn,
        'HTTP Tests',
      );

      logger.debug(`Rule ${rule.meta.name} finished with success: false`);
      allSuccessful = false;
    } catch (e) {
      if (e instanceof ThymianBaseError) {
        throw new ThymianBaseError(
          `Error running rule ${rule.meta.name}: ${e.message}`,
          {
            name: 'TestLinterError',
            cause: e,
          },
        );
      } else {
        throw new ThymianBaseError(
          `Error running rule ${rule.meta.name}: ${e}`,
          {
            name: 'TestLinterError',
            cause: e,
          },
        );
      }
    }
  }

  return { valid: allSuccessful, violations };
}

function selectRules(
  runtimeRules: Rule[],
  fallbackRules: Rule[],
  ruleFilter: (rule: Rule) => boolean,
): Rule[] {
  return (runtimeRules.length > 0 ? runtimeRules : fallbackRules).filter(
    ruleFilter,
  );
}

export function createHttpTesterPlugin(
  pluginName = '@thymian/http-tester',
): ThymianPlugin<HttpTesterPluginOptions> {
  return {
    name: pluginName,
    version: '0.x',
    actions: {
      listensOn: ['core.test'],
    },
    async plugin(emitter, logger, options) {
      const ruleFilter = createRuleFilter({
        severity: options.severity ?? 'hint',
        type: ['test'],
      });
      const loadedRules = await loadRules(
        options.ruleSets,
        ruleFilter,
        options.rules ?? {},
      );

      emitter.onAction('core.test', async ({ format, rules = [] }, ctx) => {
        const thymianFormat = ThymianFormat.import(format);
        const reports: ThymianReport[] = [];

        const { valid, violations } = await runTestLinter(
          logger,
          emitter,
          selectRules(rules, loadedRules, ruleFilter),
          (report) => {
            reports.push(report);
            emitter.emit('core.report', report);
          },
          thymianFormat,
          options.rules ?? {},
        );

        ctx.reply({
          status: valid ? 'success' : 'failed',
          reports,
          violations,
        });
      });
    },
  };
}

export const httpTesterPlugin = createHttpTesterPlugin();

export default httpTesterPlugin;
