import {
  type Logger,
  type SerializedThymianFormat,
  ThymianEmitter,
  ThymianFormat,
  type ThymianPlugin,
} from '@thymian/core';
import type {} from '@thymian/request-dispatcher';
import type {} from '@thymian/sampler';
import type {} from '@thymian/format-validator';

import { StaticApiContext } from './api-context/static-api-context.js';
import { createContext } from './linter/create-context.js';
import { Linter } from './linter/linter.js';
import { loadRules } from './load-rules.js';
import type { Rule } from './rule/rule.js';
import type { RuleType } from './rule/rule-meta.js';
import type { RuleSeverity } from './rule/rule-severity.js';

export * from './api-context/http-test-api-context.js';
export * from './api-context/static-api-context.js';
export * from './linter/linter.js';
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
        severity?: RuleSeverity;
        modes?: RuleType[];
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

export const httpLinterPlugin: ThymianPlugin<{
  rules: string[];
  ruleOptions: Record<string, unknown>;
  origin?: string;
}> = {
  name: '@thymian/http-linter',
  options: {
    type: 'object',
    required: ['rules', 'ruleOptions'],
    properties: {
      ruleOptions: {
        type: 'object',
        additionalProperties: true,
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
    },
  },
  version: '0.x',
  async plugin(
    emitter: ThymianEmitter,
    logger: Logger,
    options
  ): Promise<void> {
    const loadedRules = await loadRules(options.rules);

    emitter.onAction('http-linter.load-rules', async ({ rules }, ctx) => {
      loadedRules.push(...(await loadRules(rules)));

      ctx.reply();
    });

    emitter.onAction('http-linter.rules', (_, ctx) => {
      ctx.reply(loadedRules);
    });

    emitter.onAction(
      'http-linter.lint',
      async ({ format, severity, modes }, ctx) => {
        const thymianFormat = ThymianFormat.import(format);

        const staticContext = new StaticApiContext(thymianFormat);
        const httpTestContext = createContext(thymianFormat, logger, emitter);

        const linter = new Linter(
          logger,
          loadedRules,
          (report) => emitter.emit('core.report', report),
          staticContext,
          httpTestContext,
          thymianFormat
        );

        ctx.reply(await linter.run(modes ?? ['static']));
      }
    );
  },
};

export default httpLinterPlugin;
