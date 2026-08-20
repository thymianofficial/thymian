import { randomBytes } from 'node:crypto';

import {
  getContentType,
  type HttpRequest,
  type HttpRequestTemplate,
  type HttpResponse,
  type Logger,
  ThymianBaseError,
  type ThymianFormat,
  thymianHttpRequestToUrl,
} from '@thymian/core';
import { type HttpTestCaseResult, serializeRequest } from '@thymian/core';

import type { TransactionCatalog } from '../selectors/transaction-catalog.js';
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

/**
 * The `utils.request(...)` key → transaction id lookup, built from the loaded
 * format's selector catalog instead of a `meta.json` on disk.
 *
 * Story 575.9 swaps the *source* only. The **key format is unchanged** — it is
 * still v1's `"<METHOD> <absolute url>"`, optionally suffixed `"-><status>"`,
 * exactly as `generate-request-types.ts` minted it into `meta.transactions`, and
 * the bare form still means "that request's lowest 2xx response". Whether the key
 * itself becomes the v2 selector is **575.7's** call; half-migrating it here would
 * leave two stories each owning part of the same decision.
 *
 * Reconstructing the key from the format is what makes `utils.request(...)` work
 * with no samples tree at all — which is the whole point of removing the
 * `meta.json` read.
 */
export function buildRequestKeyIndex(
  catalog: TransactionCatalog,
): (key: string) => string | undefined {
  const byKey = new Map<string, string>();
  const lowest2xx = new Map<string, number>();

  for (const [, transaction] of catalog.entries()) {
    const base = `${transaction.thymianReq.method.toUpperCase()} ${thymianHttpRequestToUrl(
      transaction.thymianReq,
    )}`;
    const status = transaction.thymianRes.statusCode;
    const statusKey = `${base}->${status}`;

    // First in catalog order wins. Two transactions can share a key when they
    // differ only by media type, which the key does not carry; v1 resolved that
    // collision by assignment order, i.e. arbitrarily. Deterministic beats
    // arbitrary, and 575.7 removes the ambiguity by keying on the selector.
    if (!byKey.has(statusKey)) {
      byKey.set(statusKey, transaction.transactionId);
    }

    if (status < 200 || status >= 300) {
      continue;
    }

    const best = lowest2xx.get(base);

    if (best === undefined || status < best) {
      lowest2xx.set(base, status);
      byKey.set(base, transaction.transactionId);
    }
  }

  return (key) => byKey.get(key);
}

export function createHookUtils<E extends Endpoints>(
  format: ThymianFormat,
  runRequest: (req: HttpRequest) => Promise<HttpResponse>,
  hookRunner: HookRunner,
  resolveTransactionId: (key: string) => string | undefined,
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
      const transactionId = resolveTransactionId(key);

      if (!transactionId) {
        throw new Error(`Could not find transaction ID for ${key}`);
      }

      const transaction = format.getThymianHttpTransactionById(transactionId);

      // `getThymianHttpTransactionById` returns `| undefined`, and that
      // `undefined` used to flow on unchecked: into
      // `hookRunner.beforeEachRequest({ ctx: undefined })`, where every entry
      // point branches on `ctx?.transactionId` and so silently ran **no** hooks,
      // and then into `serializeRequest({ source: undefined })`, which
      // type-checks because `HttpTestCaseStepTransaction.source` is optional and
      // which silently drops the declared path-parameter styles. Two silent
      // wrong answers; fail instead.
      if (!transaction) {
        throw new ThymianBaseError(
          `The transaction id "${transactionId}" resolved for "${key}" is not in the loaded API description.`,
          {
            name: 'StaleTransactionIdError',
            suggestions: [
              'The loaded specification changed since this lookup was built. Re-run the command; if it persists, the request key no longer names a transaction that exists.',
            ],
          },
        );
      }

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
