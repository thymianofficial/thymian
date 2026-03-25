import { isAbsolute, join } from 'node:path';

import {
  type CapturedTrace,
  type CapturedTransaction,
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
  type SerializedThymianFormat,
  type SingleRuleConfiguration,
  ThymianBaseError,
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
  thymianHttpTransactionToString,
  type ThymianPlugin,
  type ThymianReport,
  thymianRequestToString,
  thymianResponseToString,
} from '@thymian/core';

import { AnalyticsApiContext } from './analytics-api-context.js';
import { SqliteHttpTransactionRepository } from './db/sqlite-http-transaction-repository.js';

export { AnalyticsApiContext } from './analytics-api-context.js';
export type { HttpTransactionRepository } from './db/http-transaction-repository.js';
export { SqliteHttpTransactionRepository } from './db/sqlite-http-transaction-repository.js';

declare module '@thymian/core' {
  interface ThymianActions {
    'http-linter.lint-analytics': {
      event: {
        format?: SerializedThymianFormat;
        transactions?: CapturedTransaction[];
        traces?: CapturedTrace[];
      };
      response: {
        reports: ThymianReport[];
        valid: boolean;
      };
    };

    'http-linter.lint-analytics-batch': {
      event: {
        format?: SerializedThymianFormat;
      };
      response: {
        reports: ThymianReport[];
        valid: boolean;
      };
    };
  }

  interface ThymianEvents {
    'http-linter.transaction': CapturedTransaction;
    'http-linter.trace': CapturedTrace;
  }
}

export type AnalyticsOptions = {
  captureTransactions?:
    | {
        type: 'in-memory';
      }
    | {
        type: 'file';
        filePath?: string;
      };
};

export type HttpAnalyzerPluginOptions = {
  ruleSets: string[];
  severity?: 'off' | 'error' | 'warn' | 'hint';
  rules?: RulesConfiguration;
  analytics?: AnalyticsOptions;
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
  category = 'Analytic Checks',
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

async function runAnalyzeLinter(
  logger: Logger,
  repository: SqliteHttpTransactionRepository,
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

  const violations: RuleViolation[] = [];
  let allSuccessful = true;

  for (const rule of filteredRules) {
    const options = isRuleSeverityLevel(rulesConfig[rule.meta.name])
      ? {}
      : (rulesConfig[rule.meta.name] as SingleRuleConfiguration | undefined);

    try {
      if (!rule.analyzeRule) {
        continue;
      }

      const result = await rule.analyzeRule(
        new AnalyticsApiContext(
          repository,
          logger,
          format,
          reportFn,
          rule.meta.appliesTo,
          (options ?? {}).skipOrigins,
        ),
        {
          ...((options ?? {}).options ?? {}),
          mode: 'analytics',
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
        'Analytic Checks',
      );

      logger.debug(`Rule ${rule.meta.name} finished with success: false`);
      allSuccessful = false;
    } catch (e) {
      if (e instanceof ThymianBaseError) {
        throw new ThymianBaseError(
          `Error running rule ${rule.meta.name}: ${e.message}`,
          {
            name: 'AnalyzeLinterError',
            cause: e,
          },
        );
      } else {
        throw new ThymianBaseError(
          `Error running rule ${rule.meta.name}: ${e}`,
          {
            name: 'AnalyzeLinterError',
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

export function createHttpAnalyzerPlugin(
  pluginName = '@thymian/http-analyzer',
): ThymianPlugin<HttpAnalyzerPluginOptions> {
  return {
    name: pluginName,
    version: '0.x',
    actions: {
      listensOn: ['core.analyze'],
    },
    events: {
      listensOn: ['http-linter.transaction'],
    },
    async plugin(emitter, logger, options) {
      const ruleFilter = createRuleFilter({
        severity: options.severity ?? 'hint',
        type: ['analytics'],
      });
      const loadedRules = await loadRules(
        options.ruleSets,
        ruleFilter,
        options.rules ?? {},
      );

      let location = ':memory:';

      if (options.analytics?.captureTransactions?.type === 'file') {
        const filePath = options.analytics.captureTransactions.filePath;
        location = filePath
          ? isAbsolute(filePath)
            ? filePath
            : join(options.cwd, filePath)
          : join(options.cwd, '.thymian', 'db', `${Date.now().toString()}.db`);
      }

      const initializedRepository = new SqliteHttpTransactionRepository(
        location,
        logger.child(`${pluginName}:HttpTransactionRepository`),
      );
      await initializedRepository.init();

      emitter.onAction('core.close', async (_, ctx) => {
        await initializedRepository.close();
        ctx.reply();
      });

      emitter.on('http-linter.transaction', (transaction) => {
        initializedRepository.insertHttpTransaction(transaction);
      });

      emitter.onAction(
        'core.analyze',
        async ({ format, rules = [], traffic }, ctx) => {
          const thymianFormat = format
            ? ThymianFormat.import(format)
            : new ThymianFormat();

          const repo = new SqliteHttpTransactionRepository(
            ':memory:',
            logger.child(`${pluginName}:HttpTransactionRepository`),
          );
          await repo.init();

          for (const trace of traffic.traces ?? []) {
            repo.insertHttpTrace(trace);
          }

          for (const transaction of traffic.transactions ?? []) {
            repo.insertHttpTransaction(transaction);
          }

          const reports: ThymianReport[] = [];

          const { valid, violations } = await runAnalyzeLinter(
            logger,
            repo,
            selectRules(rules, loadedRules, ruleFilter),
            (report) => {
              reports.push(report);
              emitter.emit('core.report', report);
            },
            thymianFormat,
            options.rules ?? {},
          );

          await repo.close();

          ctx.reply({
            status: valid ? 'success' : 'failed',
            reports,
            violations,
          });
        },
      );

      emitter.onAction(
        'http-linter.lint-analytics-batch',
        async ({ format }, ctx) => {
          const reports: ThymianReport[] = [];

          const { valid } = await runAnalyzeLinter(
            logger,
            initializedRepository,
            loadedRules,
            (report) => reports.push(report),
            format ? ThymianFormat.import(format) : new ThymianFormat(),
            options.rules ?? {},
          );

          ctx.reply({
            reports,
            valid,
          });
        },
      );

      emitter.onAction(
        'http-linter.lint-analytics',
        async ({ format, traces, transactions }, ctx) => {
          const repo = new SqliteHttpTransactionRepository(
            ':memory:',
            logger.child(`${pluginName}:HttpTransactionRepository`),
          );
          await repo.init();

          for (const trace of traces ?? []) {
            repo.insertHttpTrace(trace);
          }

          for (const transaction of transactions ?? []) {
            repo.insertHttpTransaction(transaction);
          }

          const reports: ThymianReport[] = [];

          const { valid } = await runAnalyzeLinter(
            logger,
            repo,
            loadedRules,
            (report) => reports.push(report),
            format ? ThymianFormat.import(format) : new ThymianFormat(),
            options.rules ?? {},
          );

          ctx.reply({
            reports,
            valid,
          });
        },
      );
    },
  };
}

export const httpAnalyzerPlugin = createHttpAnalyzerPlugin();

export default httpAnalyzerPlugin;
