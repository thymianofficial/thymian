import {
  type HttpRequest,
  type HttpResponse,
  type Logger,
  type SerializedThymianFormat,
  ThymianEmitter,
  ThymianFormat,
  type ThymianPlugin,
} from '@thymian/core';
import type {} from '@thymian/request-dispatcher';
import type {} from '@thymian/sampler';

import { HttpTransactionRepository } from './db/http-transaction-repository.js';
import { AnalyticsLinter } from './linter/analytics-linter.js';
import { createContext } from './linter/create-context.js';
import { HttpTestLinter } from './linter/http-test-linter.js';
import { StaticLinter } from './linter/static-linter.js';
import { loadRules } from './load-rules.js';
import type { Rule } from './rule/rule.js';
import {
  type HttpParticipantRole,
  httpParticipantRoles,
} from './rule/rule-meta.js';
import { type RuleSeverity, severityLevels } from './rule/rule-severity.js';
import { createRuleFilter } from './rule-filter.js';

export * from './api-context/api-context.js';
export * from './api-context/http-test-api-context.js';
export * from './api-context/static-api-context.js';
export * from './api-context/utils.js';
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

    'http-linter.analyze-transactions': {
      event: {
        analyzeOptions: {
          format: SerializedThymianFormat;
        };
        transactions: {
          request: HttpRequest;
          response: HttpResponse;
          meta: Record<PropertyKey, unknown>;
        }[];
      };
      response: boolean;
    };
  }
}

export type HttpLinterPluginOptions = {
  rules: string[];
  ruleOptions: Record<string, Record<string, unknown> | undefined>;
  modes?: ('static' | 'test')[];
  origin?: string;
  ruleFilter?: {
    severity?: RuleSeverity;
    appliesTo?: HttpParticipantRole[];
  };
};

export const httpLinterPlugin: ThymianPlugin<HttpLinterPluginOptions> = {
  name: '@thymian/http-linter',
  options: {
    type: 'object',
    required: ['rules', 'ruleOptions'],
    properties: {
      ruleOptions: {
        type: 'object',
        additionalProperties: true,
      },
      modes: {
        nullable: true,
        type: 'array',
        items: {
          type: 'string',
          enum: ['static', 'test'],
        },
      },
      rules: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      origin: {
        type: 'string',
        nullable: true,
      },
      ruleFilter: {
        type: 'object',
        additionalProperties: false,
        nullable: true,
        properties: {
          severity: {
            type: 'string',
            enum: severityLevels,
            nullable: true,
          },
          appliesTo: {
            type: 'array',
            items: {
              type: 'string',
              enum: httpParticipantRoles,
            },
            nullable: true,
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
    options
  ): Promise<void> {
    const ruleFilter = createRuleFilter(options.ruleFilter);

    const loadedRules = await loadRules(
      options.rules,
      ruleFilter,
      options.ruleOptions
    );

    logger.debug(`${loadedRules.length} rules were initially loaded.`);

    const modes = options.modes ?? ['static'];

    emitter.onAction('http-linter.load-rules', async ({ rules }, ctx) => {
      const additionalLoadedRules = await loadRules(
        rules,
        ruleFilter,
        options.ruleOptions
      );

      loadedRules.push(...additionalLoadedRules);

      logger.debug(
        `Loaded ${additionalLoadedRules.length} additional rules for @thymian/http-linter.`
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
            options.ruleOptions
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
            options.ruleOptions
          ).run()) && valid;
      }

      ctx.reply({
        pluginName: '@thymian/http-linter',
        status: valid ? 'success' : 'failed',
      });
    });

    emitter.onAction(
      'http-linter.analyze-transactions',
      async ({ transactions, analyzeOptions }, ctx) => {
        const repository = new HttpTransactionRepository(':memory:', logger);
        await repository.init();

        const thymianFormat = ThymianFormat.import(analyzeOptions.format);

        for (const { response, request } of transactions) {
          repository.insertHttpTransaction(request, response);
        }

        const valid = await new AnalyticsLinter(
          repository,
          logger,
          loadedRules,
          (report) => emitter.emit('core.report', report),
          thymianFormat,
          options.ruleOptions
        ).run();

        ctx.reply(valid);
      }
    );
  },
};

export default httpLinterPlugin;
