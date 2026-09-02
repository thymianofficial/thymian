import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import {
  getContentType,
  type HttpRequestTemplate,
  type HttpResponse,
  type HttpTestCaseResult,
  ThymianBaseError,
} from '@thymian/core';

import type { Selector } from '../selectors/selector.js';
import { FailError, SkipError } from './hook-errors.js';
import type {
  EndpointRequest,
  EndpointResponse,
  Endpoints,
  HookUtils,
  RequestOptions,
} from './hook-utils.js';

const charset =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** What one hook call needs to know about where it came from and what it shapes. */
export type HookCallContext = {
  /** Absolute directory of the hook file, for the file helpers. */
  dir: string;
  /** The request this hook is shaping, for the typed setters. */
  request: HttpRequestTemplate | undefined;
  /** Where a hook's assertions and messages land. */
  results: HttpTestCaseResult[];
  /**
   * Runs a cross-endpoint request. Absent where there is no pipeline to run one
   * through — a `defineSample` hook runs before any request exists.
   */
  requestOther?: (
    selector: Selector,
    args: EndpointRequest,
    options: RequestOptions,
  ) => Promise<EndpointResponse>;
};

export function createHookUtils<E extends Endpoints>(
  context: HookCallContext,
): HookUtils<E> {
  const { dir, results } = context;

  /**
   * The request a setter writes into.
   *
   * A hook that has none is one that shapes nothing — the run-scoped pair. A
   * setter there is a mistake worth naming rather than a silent no-op.
   */
  function request(setter: string): HttpRequestTemplate {
    if (!context.request) {
      throw new ThymianBaseError(
        `utils.${setter} needs a request to write into, and this hook has none.`,
        {
          name: 'NoRequestToShapeError',
          suggestions: [
            'beforeAll and afterAll run once per run rather than per transaction, so there is no request to shape there.',
          ],
        },
      );
    }

    return context.request;
  }

  function filePath(path: string): string {
    return isAbsolute(path) ? path : resolve(dir, path);
  }

  return {
    assertionFailure(message: string, details = {}): void {
      results.push({ type: 'assertion-failure', message, ...details });
    },
    assertionSuccess(message, assertion): void {
      results.push({ type: 'assertion-success', message, assertion });
    },
    info(message: string): void {
      results.push({ type: 'info', message });
    },
    timeout(message, durationMs: number): void {
      results.push({ type: 'timeout', message, durationMs });
    },
    warn(message: string, details?: string): void {
      results.push({ type: 'warning', message, details });
    },
    randomString(length = 10): string {
      const bytes = randomBytes(length);
      const result = new Array<string>(length);

      for (let i = 0; i < length; i++) {
        result[i] = charset[bytes[i]! % charset.length] as string;
      }

      return result.join('');
    },

    setHeader(name, value): void {
      request('setHeader').headers[name] = value;
    },
    setQuery(name, value): void {
      request('setQuery').query[name] = value;
    },
    setPathParam(name, value): void {
      request('setPathParam').pathParameters[name] = value;
    },
    setCookie(name, value): void {
      request('setCookie').cookies[name] = value;
    },
    setBody(body): void {
      request('setBody').body = body;
    },
    setAuthorize(authorize): void {
      request('setAuthorize').authorize = authorize;
    },

    readFile(path): Buffer {
      return readFileSync(filePath(path));
    },
    readText(path, encoding = 'utf-8'): string {
      return readFileSync(filePath(path), encoding);
    },
    readJson<T = unknown>(path: string): T {
      return JSON.parse(readFileSync(filePath(path), 'utf-8')) as T;
    },

    async request<R extends keyof E>(
      selector: R,
      args: E[R]['req'] = {},
      options: RequestOptions = {},
    ): Promise<E[R]['res']> {
      if (typeof selector !== 'string') {
        throw new ThymianBaseError(
          'utils.request takes a transaction selector as its first argument.',
          { name: 'MalformedSelectorError' },
        );
      }

      if (!context.requestOther) {
        throw new ThymianBaseError(
          `Cannot run a cross-endpoint request for "${selector}" from this hook.`,
          {
            name: 'NoNestedRequestError',
            suggestions: [
              'A defineSample hook runs before any request exists, so there is no pipeline for a nested request to run through. Seed from beforeAll or beforeEach instead.',
            ],
          },
        );
      }

      return (await context.requestOther(
        selector,
        args,
        options,
      )) as E[R]['res'];
    },

    fail(msg: string): never {
      throw new FailError(msg);
    },
    skip(msg: string): never {
      throw new SkipError(msg);
    },
  };
}

/**
 * The body a hook sees, parsed when the response says it is JSON and left as
 * the raw string when it does not.
 */
export function parseResponseBody(res: HttpResponse): unknown {
  const contentType = getContentType(res.headers);

  if (
    typeof res.body === 'string' &&
    (/^application\/json/i.test(contentType) ||
      /^.*\/.*\+json/i.test(contentType))
  ) {
    return JSON.parse(res.body);
  }

  return res.body;
}
