import { randomBytes } from 'node:crypto';

import {
  getContentType,
  type HttpRequest,
  type HttpRequestTemplate,
  type HttpResponse,
  type Logger,
  type ThymianFormat,
} from '@thymian/core';
import {
  type HttpTestCaseResult,
  serializeRequest,
} from '@thymian/http-testing';

import { FailError, SkipError } from './hook-errors.js';
import type { HookRunner } from './hook-runner.js';
import type { EndpointRequest, Endpoints, HookUtils } from './hook-utils.js';

const charset =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function toHttpRequestTemplate(
  methodAndUrl: string,
  req: EndpointRequest,
): HttpRequestTemplate {
  const [method, url] = methodAndUrl.split(' ');

  if (!method || !url) {
    throw new Error(
      `Invalid url format: ${url}. Expected format: <METHOD> <PATH>`,
    );
  }

  const urlInstance = new URL(url);

  return {
    authorize: false,
    cookies: req.cookies ?? {},
    headers: req.headers ?? {},
    method,
    origin: urlInstance.origin,
    path: decodeURI(urlInstance.pathname),
    pathParameters: req.path ?? {},
    query: req.query ?? {},
    body: req.body,
  } satisfies HttpRequestTemplate;
}

export function createHookUtils<E extends Endpoints>(
  format: ThymianFormat,
  runRequest: (req: HttpRequest) => Promise<HttpResponse>,
  hookRunner: HookRunner,
  urlToTransactionId: Record<string, string>,
  results: HttpTestCaseResult[],
  logger: Logger,
): HookUtils<E> {
  return {
    assertionFailure(message: string, details = {}): void {
      results.push({
        type: 'assertion-failure',
        message,
        ...details,
      });
    },
    assertionSuccess(message, assertion: string): void {
      results.push({
        type: 'assertion-success',
        message,
        assertion,
      });
    },
    info(message: string): void {
      results.push({
        type: 'info',
        message,
      });
    },
    timeout(message, durationMs: number): void {
      results.push({
        type: 'timeout',
        message,
        durationMs,
      });
    },
    warn(message: string, details?: string): void {
      results.push({
        type: 'warning',
        message,
        details,
      });
    },
    randomString(length = 10): string {
      const bytes = randomBytes(length);
      const result = new Array(length);

      for (let i = 0; i < length; i++) {
        result[i] = charset[bytes[i]! % charset.length];
      }

      return result.join('');
    },
    async request<R extends keyof E>(
      url: R,
      args: E[R]['req'],
      _options: {
        runHooks?: boolean;
        authorize?: boolean;
        forStatusCode?: number;
      } = {},
    ): Promise<E[R]['res']> {
      if (typeof url !== 'string') {
        throw new Error('Invalid url format.');
      }

      const options = {
        runHooks: true,
        ..._options,
      };

      const key = `${url}${options.forStatusCode ? `->${options.forStatusCode}` : ''}`;
      const transactionId = urlToTransactionId[key];

      if (!transactionId) {
        throw new Error(`Could not find transaction ID for ${key}`);
      }

      const transaction = format.getThymianHttpTransactionById(transactionId);

      let reqTemplate = toHttpRequestTemplate(url, args);

      if (options.runHooks) {
        logger.debug(`Running beforeEach hooks for ${key}.`);

        const res = await hookRunner.beforeEachRequest({
          value: reqTemplate,
          ctx: transaction,
        });

        reqTemplate = res.result;
      }

      if (options.runHooks || options.authorize) {
        logger.debug(`Running authorize hook for ${key}.`);

        const res = await hookRunner.authorize({
          value: reqTemplate,
          ctx: transaction,
        });

        reqTemplate = res.result;
      }

      const req = serializeRequest({
        requestTemplate: reqTemplate,
        source: transaction,
      });

      let response = await runRequest(req);

      if (options.runHooks) {
        logger.debug(`Running afterEach hook for ${key}.`);

        const resHookResult = await hookRunner.afterEachResponse({
          value: response,
          ctx: {
            requestTemplate: reqTemplate,
            request: req,
          },
        });

        response = resHookResult.result;
      }

      return {
        body: parseResponseBody(response),
        headers: response.headers,
        statusCode: response.statusCode,
      };
    },
    fail(msg: string): never {
      throw new FailError(msg);
    },
    skip(msg: string): never {
      throw new SkipError(msg);
    },
  };
}

export function parseResponseBody(res: HttpResponse): unknown {
  const ct = getContentType(res.headers);

  if (
    typeof res.body === 'string' &&
    (ct.match(/^application\/json/i) || ct.match(/^.*\/.*\+json/i))
  ) {
    return JSON.parse(res.body);
  }

  return res;
}
