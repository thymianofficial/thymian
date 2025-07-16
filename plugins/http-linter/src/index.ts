import {
  type Logger,
  type SerializedThymianFormat,
  ThymianEmitter,
  ThymianFormat,
  type ThymianPlugin,
} from '@thymian/core';
import type {} from '@thymian/format-validator';
import type {} from '@thymian/request-dispatcher';
import type {} from '@thymian/sampler';

import { createContext } from './linter/create-context.js';
import { Linter } from './linter/linter.js';
import { loadRules } from './load-rules.js';
import type { Rule } from './rule/rule.js';
import {
  type HttpParticipantRole,
  httpParticipantRoles,
  type RuleType,
  ruleTypes,
} from './rule/rule-meta.js';
import { type RuleSeverity, severityLevels } from './rule/rule-severity.js';
import { createRuleFilter } from './rule-filter.js';

export * from './api-context/http-test-api-context.js';
export * from './api-context/static-api-context.js';
export * from './linter/linter.js';
export * from './linter/utils.js';
export * from './rule/rule.js';
export * from './rule/rule-fn.js';
export * from './rule/rule-meta.js';
export * from './rule/rule-set.js';
export * from './rule/rule-severity.js';
export * from './rule/rule-violation.js';
export * from './rule-builder.js';

declare module '@thymian/core' {
  interface ThymianActions {
    'http-linter.lint': {
      event: {
        format: SerializedThymianFormat;
      };
      response: boolean;
    };

    'http-linter.load-rules': {
      event: { rules: string[] };
      response: void;
    };

    'http-linter.rules': {
      event: never;
      response: Rule[];
    };
  }
}

export type HttpLinterPluginOptions = {
  rules: string[];
  ruleOptions: Record<string, unknown>;
  modes?: RuleType[];
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
          enum: ruleTypes,
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

    const modes = options.modes ?? ['static', 'test'];

    emitter.onAction('http-linter.load-rules', async ({ rules }, ctx) => {
      try {
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
      } catch (e) {
        ctx.error(e);
      }
    });

    emitter.onAction('http-linter.rules', (_, ctx) => {
      ctx.reply(loadedRules);
    });

    emitter.onAction('core.run', async (format, ctx) => {
      const thymianFormat = ThymianFormat.import(format);

      const httpTestContext = createContext(thymianFormat, logger, emitter);

      const linter = new Linter(
        logger,
        loadedRules,
        (report) => emitter.emit('core.report', report),
        httpTestContext,
        thymianFormat,
        options.ruleOptions
      );

      const valid = await linter.run(modes);

      ctx.reply({
        pluginName: '@thymian/http-linter',
        status: valid ? 'success' : 'failed',
      });
    });

    emitter.onAction('http-linter.lint', async ({ format }, ctx) => {
      const thymianFormat = ThymianFormat.import(format);

      const httpTestContext = createContext(thymianFormat, logger, emitter);

      const linter = new Linter(
        logger,
        loadedRules,
        (report) => emitter.emit('core.report', report),
        httpTestContext,
        thymianFormat,
        options.ruleOptions
      );

      ctx.reply(await linter.run(modes));
    });
  },
};

export default httpLinterPlugin;
