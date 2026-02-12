import { isAbsolute, join } from 'node:path';

import {
  type Logger,
  type SerializedThymianFormat,
  ThymianBaseError,
  ThymianEmitter,
  ThymianFormat,
  type ThymianPlugin,
  type ThymianReport,
} from '@thymian/core';
import type {} from '@thymian/request-dispatcher';
import type {} from '@thymian/sampler';

import type { HttpTransactionRepository } from './db/http-transaction-repository.js';
import { SqliteHttpTransactionRepository } from './db/sqlite/sqlite-http-transaction-repository.js';
import { AnalyticsLinter } from './linter/analytics-linter.js';
import { createContext } from './linter/create-context.js';
import { HttpTestLinter } from './linter/http-test-linter.js';
import { StaticLinter } from './linter/static-linter.js';
import { loadRules } from './load-rules.js';
import type { Rule } from './rule/rule.js';
import { type RuleType, ruleTypes } from './rule/rule-meta.js';
import { type RuleSeverity, severityLevels } from './rule/rule-severity.js';
import type { RulesConfiguration } from './rule-configuration.js';
import { createRuleFilter } from './rule-filter.js';
import type { CapturedTrace, CapturedTransaction } from './types.js';

export * from './api-context/api-context.js';
export * from './api-context/http-test-api-context.js';
export * from './api-context/static-api-context.js';
export * from './rule/rule.js';
export * from './rule/rule-fn.js';
export * from './rule/rule-meta.js';
export * from './rule/rule-set.js';
export * from './rule/rule-severity.js';
export * from './rule/rule-violation.js';
export * from './rule-builder.js';

declare module '@thymian/core' {
  interface ThymianActions {
    'http-linter.load-rules': {
      event: { rules: string[] };
      response: void;
    };

    'http-linter.rules': {
      event: never;
      response: Rule[];
    };

    'http-linter.lint-static': {
      event: {
        format: SerializedThymianFormat;
      };
      response: {
        reports: ThymianReport[];
        valid: boolean;
      };
    };

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

export type HttpLinterPluginOptions = {
  ruleSets: string[];
  severity?: RuleSeverity;
  type?: RuleType[];
  analytics?: AnalyticsOptions;
  rules?: RulesConfiguration;
};

export const httpLinterPlugin: ThymianPlugin<HttpLinterPluginOptions> = {
  name: '@thymian/http-linter',
  options: {
    // ### for reference documentation ###
    title: 'Plugin Options',
    description: 'Configuration options for the HTTP Linter plugin',
    // ###################################
    type: 'object',
    required: ['ruleSets'],
    properties: {
      type: {
        description: 'Defines with which contexts the rules are run.',
        nullable: true,
        type: 'array',
        items: {
          description: 'Defines with which contexts the rules are run.',
          type: 'string',
          enum: ruleTypes,
        },
      },
      ruleSets: {
        description:
          'Array of rule sets to load. Can be package names or file paths (absolute or relative to the current working directory).',
        type: 'array',
        nullable: false,
        items: {
          description:
            'Array of rule sets to load. Can be package names or file paths (absolute or relative to the current working directory).',
          type: 'string',
        },
      },
      rules: {
        description:
          'Per-rule configuration to override default settings. Keys are rule names, values can be either a severity level string or a configuration object.',
        type: 'object',
        nullable: true,
        required: [],
        additionalProperties: {
          type: ['string', 'object'], // this is required for the documentation generation
          oneOf: [
            {
              description: 'Set the severity level for this rule.',
              type: 'string',
              enum: severityLevels,
            },
            {
              description: 'Detailed configuration for this rule.',
              type: 'object',
              additionalProperties: false,
              nullable: false,
              required: [],
              properties: {
                severity: {
                  description:
                    'Override the default severity level for this rule.',
                  nullable: true,
                  type: 'string',
                  enum: severityLevels,
                },
                type: {
                  description:
                    'Override which execution modes this rule applies to.',
                  nullable: true,
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ruleTypes,
                  },
                },
                skipOrigins: {
                  description:
                    'Array of origin (patterns) to exclude from this rule. Transactions or operations matching these origins will not be checked by this rule.',
                  examples: [['*.my-domain.de']],
                  type: 'array',
                  nullable: true,
                  items: {
                    type: 'string',
                  },
                },
                options: {
                  description:
                    'Rule-specific configuration options. The structure depends on the individual rule being configured. Refer to the rule documentation for available options.',
                  type: 'object',
                  nullable: true,
                  additionalProperties: true,
                },
              },
            },
          ],
        },
      },
      severity: {
        description: 'Set the severity the linter is run with.',
        type: 'string',
        nullable: true,
        enum: severityLevels,
      },
      analytics: {
        description:
          'Configuration for analytics mode, which analyzes captured HTTP traffic. Required when using type "analytics".',
        type: 'object',
        nullable: true,
        additionalProperties: false,
        properties: {
          captureTransactions: {
            description:
              'Specifies how to capture and store HTTP transactions for analytics linting. Transactions can be stored in-memory (fast, lost on exit) or persisted to a SQLite database file.',
            nullable: true,
            type: 'object',
            required: ['type'],
            oneOf: [
              {
                description:
                  'Store HTTP transactions in memory. Fast and suitable for short-lived processes or when persistence is not needed. All captured data is lost when the process exits.',
                properties: {
                  type: {
                    description:
                      'Storage type identifier for in-memory transaction capture.',
                    const: 'in-memory',
                  },
                },
                required: ['type'],
                additionalProperties: false,
              },
              {
                description:
                  'Store HTTP transactions in a SQLite database file. Allows persistence and analysis after the process exits. If filePath is not specified, a timestamped database file is created in .thymian/db/.',
                properties: {
                  type: {
                    description:
                      'Storage type identifier for file-based transaction capture.',
                    const: 'file',
                  },
                  filePath: {
                    description:
                      'Path to the SQLite database file for storing transactions. Can be absolute or relative to the current working directory. If not specified, defaults to ".thymian/db/{timestamp}.db".',
                    type: 'string',
                  },
                },
                required: ['type'],
                additionalProperties: false,
              },
            ],
          },
        },
      },
    },
  },
  actions: {
    listensOn: ['core.run'],
  },
  version: '0.x',
  async plugin(
    emitter: ThymianEmitter,
    logger: Logger,
    options,
  ): Promise<void> {
    const modes = options.type ?? ['static'];
    const severity = options.severity ?? 'hint';
    const ruleOptions = options.rules ?? {};

    logger.debug(
      `Running in mode(s): ${modes.join(', ')} with severity "${severity}".`,
    );

    const ruleFilter = createRuleFilter({
      severity,
      type: modes,
    });

    const loadedRules = await loadRules(
      options.ruleSets,
      ruleFilter,
      options.rules ?? {},
    );

    logger.debug(`${loadedRules.length} rules were initially loaded.`);

    let transactionRepository: HttpTransactionRepository | undefined;

    if (modes.includes('analytics')) {
      let location = ':memory:';

      if (options.analytics?.captureTransactions?.type === 'file') {
        const filePath = options.analytics.captureTransactions.filePath;

        if (!filePath) {
          location = join(
            options.cwd,
            '.thymian',
            'db',
            `${Date.now().toString()}.db`,
          );
        } else {
          location = isAbsolute(filePath)
            ? filePath
            : join(options.cwd, filePath);
        }
      }

      transactionRepository = new SqliteHttpTransactionRepository(
        location,
        logger.child('@thymian/http-linter:HttpTransactionRepository'),
      );
      await transactionRepository.init();
    }

    emitter.onAction('core.close', async (_, ctx) => {
      await transactionRepository?.close();

      ctx.reply();
    });

    emitter.onAction('http-linter.load-rules', async ({ rules }, ctx) => {
      const additionalLoadedRules = await loadRules(
        rules,
        ruleFilter,
        options.rules ?? {},
      );

      loadedRules.push(...additionalLoadedRules);

      logger.debug(
        `Loaded ${additionalLoadedRules.length} additional rules for @thymian/http-linter.`,
      );

      ctx.reply();
    });

    emitter.onAction('http-linter.rules', (_, ctx) => {
      ctx.reply(loadedRules);
    });

    emitter.onAction('core.run', async (format, ctx) => {
      const thymianFormat = ThymianFormat.import(format);

      let valid = true;

      if (modes.includes('static')) {
        valid =
          (await new StaticLinter(
            logger,
            loadedRules,
            (report) => emitter.emit('core.report', report),
            thymianFormat,
            ruleOptions,
          ).run()) && valid;
      }

      if (modes.includes('test')) {
        const httpTestContext = createContext(thymianFormat, logger, emitter);

        valid =
          (await new HttpTestLinter(
            httpTestContext,
            logger,
            loadedRules,
            (report) => emitter.emit('core.report', report),
            thymianFormat,
            ruleOptions,
          ).run()) && valid;
      }

      ctx.reply({
        pluginName: '@thymian/http-linter',
        status: valid ? 'success' : 'failed',
      });
    });

    emitter.onAction('http-linter.lint-static', async ({ format }, ctx) => {
      const thymianFormat = ThymianFormat.import(format);

      const reports: ThymianReport[] = [];

      const valid = await new StaticLinter(
        logger,
        loadedRules,
        (report) => reports.push(report),
        thymianFormat,
        ruleOptions,
      ).run();

      ctx.reply({
        valid,
        reports,
      });
    });

    emitter.on('http-linter.transaction', (transaction) => {
      if (typeof transactionRepository === 'undefined') {
        logger.warn(
          'Received HTTP transaction but HttpTransactionRepository is not yet initialized.',
        );

        return;
      }

      transactionRepository.insertHttpTransaction(transaction);
    });

    emitter.onAction(
      'http-linter.lint-analytics-batch',
      async ({ format }, ctx) => {
        if (typeof transactionRepository === 'undefined') {
          return ctx.error(
            new ThymianBaseError(
              'Cannot run analytics linting because the HttpTransactionRepository is not initialized.',
            ),
          );
        }

        const thymianFormat = format
          ? ThymianFormat.import(format)
          : new ThymianFormat();

        const reports: ThymianReport[] = [];

        const valid = await new AnalyticsLinter(
          transactionRepository,
          logger,
          loadedRules,
          (report) => reports.push(report),
          thymianFormat,
          ruleOptions,
        ).run();

        ctx.reply({
          valid,
          reports,
        });
      },
    );

    emitter.onAction(
      'http-linter.lint-analytics',
      async ({ format, traces, transactions }, ctx) => {
        if (!traces || transactions) {
          logger.warn('No traffic was sent with "http-linter.lint-analytics".');
        }

        const thymianFormat = format
          ? ThymianFormat.import(format)
          : new ThymianFormat();

        const repo = new SqliteHttpTransactionRepository(
          ':memory:',
          logger.child('@thymian/http-linter:HttpTransactionRepository'),
        );
        await repo.init();

        if (traces) {
          for (const trace of traces) {
            repo.insertHttpTrace(trace);
          }
        }

        if (transactions) {
          for (const transaction of transactions) {
            repo.insertHttpTransaction(transaction);
          }
        }

        const reports: ThymianReport[] = [];

        const valid = await new AnalyticsLinter(
          repo,
          logger,
          loadedRules,
          (report) => reports.push(report),
          thymianFormat,
          ruleOptions,
        ).run();

        ctx.reply({
          valid,
          reports,
        });
      },
    );
  },
};

export default httpLinterPlugin;
