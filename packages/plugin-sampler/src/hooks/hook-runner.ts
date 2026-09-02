import type { HttpTestCaseResult, HttpTestHooks } from '@thymian/core';
import {
  type HttpRequest,
  type HttpResponse,
  type Logger,
  ThymianBaseError,
  ThymianFormat,
  thymianHttpTransactionToString,
} from '@thymian/core';

import { createHookUtils } from './create-hook-utils.js';
import { FailError, SkipError } from './hook-errors.js';
import type { Hooks } from './hook-types.js';

export class HookRunner {
  private hooks: Map<string, Hooks> = new Map();
  private format: ThymianFormat = new ThymianFormat();

  constructor(
    private readonly runRequest: (req: HttpRequest) => Promise<HttpResponse>,
    private readonly logger: Logger,
  ) {}

  /**
   * Adopt a newly loaded format.
   *
   * Nothing is read from disk: an unregistered transaction simply has no hooks,
   * which is the pass-through case, so there is no "not initialized" state left
   * to guard against.
   */
  load(format: ThymianFormat): void {
    this.format = format;
    this.hooks = new Map();
  }

  async afterEachResponse(
    hook: HttpTestHooks['afterResponse']['arg'],
  ): Promise<HttpTestHooks['afterResponse']['return']> {
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
