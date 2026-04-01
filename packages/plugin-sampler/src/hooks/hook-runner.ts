import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { HttpTestCaseResult, HttpTestHooks } from '@thymian/core';
import {
  type HttpRequest,
  type HttpResponse,
  type Logger,
  ThymianBaseError,
  type ThymianFormat,
  thymianHttpTransactionToString,
} from '@thymian/core';

import { readSamplesFromDir } from '../samples-structure/read-samples-from-dir.js';
import type {
  Hooks,
  SamplesStructure,
} from '../samples-structure/samples-tree-structure.js';
import type { StructureMetaOnDisc } from '../samples-structure/structure-meta-on-disc.js';
import { entryExists } from '../utils.js';
import { createHookUtils } from './create-hook-utils.js';
import { FailError, SkipError } from './hook-errors.js';
import { loadHooksFromSamples } from './load-hooks-from-samples.js';

export class HookRunner {
  private initialized = false;
  private hooks: Map<string, Hooks> = new Map();
  private urlToTransactionId: Record<string, string> = {};
  private format!: ThymianFormat;

  constructor(
    private readonly path: string,
    private readonly runRequest: (req: HttpRequest) => Promise<HttpResponse>,
    private readonly logger: Logger,
  ) {}

  async init(
    format: ThymianFormat,
    samplesStructure?: SamplesStructure,
  ): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!(await entryExists(this.path))) {
      return;
    }

    const samples = samplesStructure ?? (await readSamplesFromDir(this.path));
    const meta = JSON.parse(
      await readFile(join(this.path, 'meta.json'), 'utf-8'),
    ) as StructureMetaOnDisc;

    this.urlToTransactionId = meta.transactions;

    this.hooks = loadHooksFromSamples(samples);
    this.format = format;
    this.initialized = true;
  }

  async afterEachResponse(
    hook: HttpTestHooks['afterResponse']['arg'],
  ): Promise<HttpTestHooks['afterResponse']['return']> {
    if (!this.initialized) {
      throw new ThymianBaseError(
        'Cannot run hooks before @thymian/sampler is initialized.',
        {
          name: 'HookRunnerNotInitialized',
          suggestions: ['Did you run "thymian sampler:init"?'],
        },
      );
    }

    const { value, ctx } = hook;

    const hooks = ctx.thymianTransaction
      ? this.hooks.get(ctx.thymianTransaction.transactionId)
      : undefined;

    let result = value;

    const testResults: HttpTestCaseResult[] = [];
    const utils = createHookUtils(
      this.format,
      this.runRequest,
      this,
      this.urlToTransactionId,
      testResults,
      this.logger,
    );

    for (const afterEach of hooks?.afterEachResponse ?? []) {
      try {
        result = await afterEach(result, ctx, utils);
      } catch (e) {
        if (e instanceof SkipError) {
          return {
            result,
            skip: e.message,
            testResults,
          };
        }
        if (e instanceof FailError) {
          return {
            result,
            fail: e.message,
            testResults,
          };
        }

        throw new ThymianBaseError(
          `Error while running afterEach hook${hook.ctx && hook.ctx.thymianTransaction ? ' for transaction: ' + thymianHttpTransactionToString(hook.ctx.thymianTransaction.thymianReq, hook.ctx.thymianTransaction.thymianRes) : ''}.`,
          {
            cause: e,
            name: 'HookError',
          },
        );
      }
    }

    return {
      result,
      testResults,
    };
  }

  async authorize(
    hook: HttpTestHooks['authorize']['arg'],
  ): Promise<HttpTestHooks['authorize']['return']> {
    if (!this.initialized) {
      throw new ThymianBaseError(
        'Cannot run hooks before @thymian/sampler is initialized.',
        {
          name: 'HookRunnerNotInitialized',
          suggestions: ['Did you run "thymian sampler:init"?'],
        },
      );
    }

    const { value, ctx } = hook;

    const hooks = ctx?.transactionId
      ? this.hooks.get(ctx.transactionId)
      : undefined;

    const authorize = hooks?.authorize?.at(-1);

    if (!authorize) {
      return {
        result: value,
      };
    }

    const testResults: HttpTestCaseResult[] = [];
    const utils = createHookUtils(
      this.format,
      this.runRequest,
      this,
      this.urlToTransactionId,
      testResults,
      this.logger,
    );

    try {
      const result = await authorize(value, ctx, utils);

      return {
        result,
        testResults,
      };
    } catch (e) {
      if (e instanceof SkipError) {
        return {
          result: value,
          skip: e.message,
          testResults,
        };
      }
      if (e instanceof FailError) {
        return {
          result: value,
          fail: e.message,
          testResults,
        };
      }

      throw new ThymianBaseError(
        `Error while running authorize hook${hook.ctx ? ' for transaction: ' + thymianHttpTransactionToString(hook.ctx.thymianReq, hook.ctx.thymianRes) : ''}.`,
        {
          cause: e,
          name: 'HookError',
        },
      );
    }
  }

  async beforeEachRequest(
    hook: HttpTestHooks['beforeRequest']['arg'],
  ): Promise<HttpTestHooks['beforeRequest']['return']> {
    if (!this.initialized) {
      throw new ThymianBaseError(
        'Cannot run hooks before @thymian/sampler is initialized.',
        {
          name: 'HookRunnerNotInitialized',
          suggestions: ['Did you run "thymian sampler:init"?'],
        },
      );
    }

    const { value, ctx } = hook;

    const hooks = ctx?.transactionId
      ? this.hooks.get(ctx.transactionId)
      : undefined;

    let result = value;

    const testResults: HttpTestCaseResult[] = [];
    const utils = createHookUtils(
      this.format,
      this.runRequest,
      this,
      this.urlToTransactionId,
      testResults,
      this.logger,
    );

    for (const beforeEach of hooks?.beforeEachRequest ?? []) {
      try {
        result = await beforeEach(result, ctx, utils);
      } catch (e) {
        if (e instanceof SkipError) {
          return {
            result,
            skip: e.message,
            testResults,
          };
        }
        if (e instanceof FailError) {
          return {
            result,
            fail: e.message,
            testResults,
          };
        }

        throw new ThymianBaseError(
          `Error while running beforeEach hook${hook.ctx ? ' for transaction: ' + thymianHttpTransactionToString(hook.ctx.thymianReq, hook.ctx.thymianRes) : ''}.`,
          {
            cause: e,
            name: 'HookError',
          },
        );
      }
    }

    return {
      result,
      testResults,
    };
  }
}
