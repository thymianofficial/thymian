import { AssertionError } from 'node:assert';

import {
  type Logger,
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';

import type { AssertionResult } from '../assertions/assertion.js';
import type { HttpTestContext } from '../http-test/context.js';
import type {
  SingleHttpTest,
  SingleHttpTestResult,
} from '../http-test/http-test.js';
import type { HttpRequestTemplate } from '../rxjs/http-request-template.js';
import type { HttpResponse } from '../rxjs/http-response.js';
import type { HookRunner } from './hook-runner.js';
import type { HttpRequestExecutor } from './request-executor.js';

export class SingleTestRunner {
  constructor(
    private readonly test: SingleHttpTest,
    private readonly logger: Logger,
    private readonly executor: HttpRequestExecutor,
    private readonly hookRunner: HookRunner,
    private readonly format: ThymianFormat
  ) {}

  async performRequest(args: {
    thymianReq: ThymianHttpRequest;
    reqId: string;
    thymianRes: ThymianHttpResponse;
    resId: string;
  }): Promise<[HttpRequestTemplate, HttpResponse]> {
    if (args.thymianReq.method === 'POST') {
      return [
        {
          origin: 'http://localhost:8080',
          path: '/users',
          pathParameters: {},
          method: 'POST',
          query: {},
          headers: {},
          body: JSON.stringify({ name: 'me' }),
        },
        {
          statusCode: 201,
          headers: {
            location: 'http://localhost:8080/users/12',
          },
          body: '',
          trailers: {},
          duration: 0,
        },
      ];
    } else {
      return [
        {
          origin: 'http://localhost:8080',
          path: '/users/12',
          pathParameters: {},
          method: 'GET',
          query: {},
          headers: {},
        },
        {
          statusCode: 200,
          headers: {},
          body: '',
          trailers: {},
          duration: 0,
        },
      ];
    }
  }

  async run(
    context: Record<PropertyKey, unknown> = {}
  ): Promise<SingleHttpTestResult[]> {
    const ctx = await this.createContext(context);
    const result = [] as SingleHttpTestResult[];

    if (this.test.groupHttpRequestsBy && this.test.mapGroupsToHttpRequests) {
      /* empty */
    } else {
      const transactions = this.format.getHttpTransactions();

      for (const [reqId, resId] of transactions) {
        const start = performance.now();

        const thymianReq = this.format.getNode<ThymianHttpRequest>(reqId);
        const thymianRes = this.format.getNode<ThymianHttpResponse>(resId);

        if (
          !this.test.transactionFilter({
            req: thymianReq,
            res: thymianRes,
            format: this.format,
            resId,
            reqId,
            ctx,
          })
        ) {
          continue;
        }

        const [req, res] = await this.performRequest({
          thymianReq,
          reqId,
          thymianRes,
          resId,
        });

        const assertionResults = await this.assert(req, res, {
          ctx,
          thymianRes,
          thymianReq,
        });

        result.push({
          transaction: {
            req,
            res,
            thymianRes,
            thymianReq,
            resId,
            reqId,
          },
          results: assertionResults.map((ar) => ({
            message: ar.message,
            type: ar.failed ? 'assertion-failure' : 'assertion-success',
          })),
          status: assertionResults.some((result) => result.failed)
            ? 'fail'
            : 'pass',
          duration: performance.now() - start,
          testName: this.test.name,
        });
      }
    }

    return result;
  }

  private async createContext(
    base: Record<PropertyKey, unknown> = {}
  ): Promise<HttpTestContext> {
    let context: HttpTestContext = {
      fail(msg: string | undefined): never {
        throw new Error(msg);
      },
      format: this.format,
      pass(): never {
        throw new Error();
      },
      skip(): never {
        throw new Error();
      },
      ...base,
    };

    for await (const fn of this.test.contextFns) {
      context = {
        ...context,
        ...(await fn(context)),
      };
    }

    return context;
  }

  private async assert(
    req: HttpRequestTemplate,
    res: HttpResponse,
    context: Record<string, unknown>
  ): Promise<AssertionResult[]> {
    const assertionResults = [] as AssertionResult[];

    for await (const assertion of this.test.assertions ?? []) {
      try {
        const results = await assertion({
          req,
          res,
          format: this.format,
          ...context,
        });

        if (Array.isArray(results)) {
          assertionResults.push(...results);
        } else if (typeof results === 'object') {
          assertionResults.push(results);
        }
      } catch (err: unknown) {
        if (err instanceof AssertionError) {
          assertionResults.push({
            message: err.message,
          });
        } else {
          throw err;
        }
      }
    }

    return assertionResults;
  }
}
