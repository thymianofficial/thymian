import {
  type HttpRequest,
  type HttpResponse,
  type Logger,
  type SerializedThymianFormat,
  ThymianEmitter,
  ThymianFormat,
  type ThymianPlugin,
  type ThymianSchema,
} from '@thymian/core';
import {
  createHttpTestContext,
  type HttpTestCaseStepTransaction,
} from '@thymian/http-testing';
import type {} from '@thymian/request-dispatcher';
import type {} from '@thymian/sampler';

import { StaticApiContext } from './api-context/static-api-context.js';
import { type HttpLintResult, Linter } from './linter/linter.js';
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
  interface ThymianHooks {
    'http-linter.lint': {
      arg: {
        format: SerializedThymianFormat;
        severity?: RuleSeverity;
        modes?: RuleType[];
      };
      returnType: boolean;
    };

    'http-linter.load-rules': {
      arg: { rules: string[] };
      returnType: void;
    };

    'http-linter.rules': {
      arg: never;
      returnType: Rule[];
    };
  }

  interface ThymianEvents {
    'http-linter.report': HttpLintResult;
  }
}

export const httpLinterPlugin: ThymianPlugin<{
  rules: string[];
  ruleOptions: Record<string, unknown>;
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
    },
  },
  version: '0.x',
  async plugin(
    emitter: ThymianEmitter,
    logger: Logger,
    options
  ): Promise<void> {
    const loadedRules = await loadRules(options.rules);

    emitter.onHook('http-linter.load-rules', async ({ rules }) => {
      loadedRules.push(...(await loadRules(rules)));

      return {};
    });

    emitter.onHook('http-linter.load-rules', async ({ rules }) => {
      loadedRules.push(...(await loadRules(rules)));

      return {};
    });

    emitter.onHook('http-linter.lint', async ({ format, severity, modes }) => {
      const ctx = createHttpTestContext({
        format: ThymianFormat.import(format),
        logger,
        generateContent: async function (
          schema: ThymianSchema,
          contentType?: string,
          context?: {
            reqId?: string;
            resId?: string;
          }
        ): Promise<{ content: unknown; encoding?: string }> {
          return (
            await emitter.runHook('sampler.generate', {
              contentType: contentType ?? 'application/json',
              schema,
            })
          )[0]!;
        },
        runRequest: async function (req: HttpRequest): Promise<HttpResponse> {
          return (
            await emitter.runHook('request-dispatcher.http-request', {
              request: req,
            })
          )[0]!;
        },
        runHook: async function (
          name: string,
          input: HttpTestCaseStepTransaction
        ): Promise<HttpTestCaseStepTransaction> {
          //return (await emitter.runHook(name, input))[0];
          return input;
        },
      });

      const linter = new Linter(
        logger,
        loadedRules,
        (result) => emitter.emitEvent('http-linter.report', result),
        new StaticApiContext(ThymianFormat.import(format)),
        ctx
      );

      return { result: await linter.run(modes ?? ['static']) };
    });
  },
};

export default httpLinterPlugin;
