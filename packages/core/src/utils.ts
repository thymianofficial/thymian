import deepmerge from '@fastify/deepmerge';
import { is } from 'type-is';

import type {
  ThymianHttpRequest,
  ThymianHttpResponse,
} from './format/index.js';
import type { HttpRequest, HttpResponse } from './http.js';
import {
  httpStatusCodeToPhrase,
  isValidHttpStatusCode,
} from './http-status-codes/index.js';
import {
  formatRequestSelector,
  formatResponseSelector,
  formatSelector,
} from './selector/render-selector.js';
import { ThymianBaseError } from './thymian.error.js';

export function timeoutPromise<T>(
  promise: Promise<T>,
  toWait = 5000,
  err?: Error,
): Promise<T> {
  let timoutId: NodeJS.Timeout;

  return Promise.race<T>([
    promise,
    new Promise((_, reject) => {
      timoutId = setTimeout(
        () => reject(err ?? new Error(`Promise timed out after ${toWait} ms.`)),
        toWait,
      );
    }),
  ]).finally(() => clearTimeout(timoutId));
}

export function isRecord(
  value: unknown,
): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && !Array.isArray(value) && value !== null;
}

export function matchObjects(source: unknown, target: unknown): boolean {
  if (!isRecord(source) || !isRecord(target)) {
    return false;
  }

  return Object.entries(target)
    .filter(([, value]) => Boolean(value))
    .every(([key, value]) => {
      if (typeof value === 'string' && typeof source[key] === 'string') {
        return (
          key in source && source[key].toLowerCase() === value.toLowerCase()
        );
      }

      return key in source && source[key] === value;
    });
}

export type KeysWithStringOrNumberValue<T> = keyof {
  [
    P in keyof T as T[P] extends (string | undefined) | (number | undefined)
      ? P
      : never
  ]: P;
};

export type StringAndNumberProperties<T> = Partial<{
  [key in KeysWithStringOrNumberValue<T>]: T[key];
}>;

export type PartialBy<T, K extends keyof T> = T extends any
  ? Omit<T, K> & Partial<Pick<T, K>>
  : never;

export function zipArrays<A, B>(as: A[], bs: B[]): [A, B][] {
  if (as.length !== bs.length) {
    throw new Error('as.length !== bs.length');
  }

  // we did a length check before
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return bs.map((b, i) => [as[i]!, b]);
}

export function getHeader(
  headers: Record<string, string | string[] | undefined> = {},
  headerName: string,
): string | string[] | undefined {
  const headerNames = Object.keys(headers);

  const found = headerNames.find(
    (name) => name.toLowerCase() === headerName.toLowerCase(),
  );

  if (found) {
    return headers[found];
  }

  return undefined;
}

export function deleteHeader<T extends Record<string, unknown> | undefined>(
  headers: T,
  headerName: string,
): T {
  const key = findKeyIgnoreCase(headers ?? {}, headerName);

  if (key && headers) {
    delete headers[key];
  }

  return headers;
}

export function findKeyIgnoreCase(
  obj: Record<PropertyKey, unknown>,
  key: PropertyKey,
): string | undefined {
  return Object.keys(obj).find(
    (k) => k.toLowerCase() === key.toString().toLowerCase(),
  );
}

export function objHasKeyIgnoreCase(
  obj: Record<PropertyKey, unknown>,
  key: PropertyKey,
): boolean {
  return !!findKeyIgnoreCase(obj, key);
}

export function setHeader(
  headers: Record<string, unknown>,
  headerName: string,
  value: unknown,
): Record<string, unknown> {
  const headerNames = Object.keys(headers);

  const found = headerNames.find(
    (name) => name.toLowerCase() === headerName.toLowerCase(),
  ) as keyof typeof headers;

  if (found) {
    headers[found] = value as (typeof headers)[typeof found];
  } else {
    headers[headerName] = value;
  }

  return headers;
}

export type PartialExceptFor<T, K extends keyof T> = Partial<Omit<T, K>> &
  Pick<T, K>;

/**
 * How Thymian writes a request node down: the **request half of its
 * Selector**, `POST /launches (application/json)`.
 *
 * One grammar for one concept (ADR-0020) — a heading a reader sees is a
 * fragment of the string a hook is anchored to, not a near-twin of it. The
 * rendering itself lives in `selector/render-selector.ts`, beside the whole-
 * transaction renderer it has to stay consistent with.
 */
export function thymianRequestToString(req: ThymianHttpRequest): string {
  return formatRequestSelector(req);
}

/**
 * How Thymian writes a response node down: the **response half of its
 * Selector**, `201 (application/json)`.
 *
 * Deliberately without the reason phrase the old display string carried:
 * `CREATED` is derivable from `201`, and it is not part of the selector
 * grammar. Failure detail text may still spell a phrase out.
 */
export function thymianResponseToString(res: ThymianHttpResponse): string {
  return formatResponseSelector(res);
}

/**
 * How Thymian writes a Transaction down: **its Selector, verbatim**.
 *
 * Every surface that names a Transaction goes through here — check lines,
 * test-case names, rule headings, report locations, error texts — so any line
 * a user reads pastes back as a hook target (ADR-0020).
 */
export function thymianHttpTransactionToString(
  req: ThymianHttpRequest,
  res: ThymianHttpResponse,
): string {
  return formatSelector(req, res);
}

export function thymianHttpRequestToUrl(req: ThymianHttpRequest): string {
  return normalizeUrl(
    `${req.protocol}://${req.host}:${req.port}${req.path.startsWith('/') ? req.path : '/' + req.path}`,
  );
}

export function equalsIgnoreCase(a: string, ...b: string[]): boolean {
  return b.some(
    (str) => a.localeCompare(str, undefined, { sensitivity: 'accent' }) === 0,
  );
}

export function capitalizeFirstChar(str: string): string {
  return String(str).charAt(0).toUpperCase() + String(str).slice(1);
}

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export function thymianRequestToOrigin(req: ThymianHttpRequest): string {
  return normalizeUrl(`${req.protocol}://${req.host}:${req.port}`);
}

export function getContentType(
  headers: Record<string, string | string[] | undefined> = {},
  defaultValue = '',
): string {
  const contentType = getHeader(headers, 'content-type');

  if (!contentType) {
    return defaultValue;
  }

  if (Array.isArray(contentType)) {
    throw new Error('Multiple content-type headers found.');
  }

  return contentType;
}

export function normalizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);

    if (
      (url.protocol === 'http:' && url.port === '80') ||
      (url.protocol === 'https:' && url.port === '443')
    ) {
      url.port = '';
    }

    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return decodeURI(url.toString());
  } catch (e) {
    throw new ThymianBaseError('Cannot normalize url: ' + urlString, {
      suggestions: ['Is the provided URL valid?'],
      name: 'InvalidUrlError',
      cause: e,
    });
  }
}

export function httpRequestToLabel(request: HttpRequest): string {
  return `${request.method.toUpperCase()} ${new URL(
    request.path,
    request.origin,
  ).toString()}`;
}

export function httpResponseToLabel(response: HttpResponse): string {
  const contentType = getHeader(response.headers, 'content-type');
  const mediaType =
    (Array.isArray(contentType) ? contentType[0] : contentType) ?? '';

  return `${response.statusCode} ${
    isValidHttpStatusCode(response.statusCode)
      ? httpStatusCodeToPhrase[response.statusCode]
      : ''
  } ${mediaType}`;
}

export function httpTransactionToLabel(
  request: HttpRequest,
  response: HttpResponse,
): string {
  return `${httpRequestToLabel(request)} \u2192 ${httpResponseToLabel(response)}`;
}

export function queryParamsFromRequest(
  req: HttpRequest,
): Record<string, string> {
  const params = new URLSearchParams(req.path.split('?')[1] ?? '');

  return Object.fromEntries(params.entries());
}

export function createRegExpFromOriginWildcard(pattern: string): RegExp {
  const regexString = `${pattern.replace(/\./g, '\\.').replace(/\*/g, '.*')}/?(:\\d{1,5})?$`;
  return new RegExp(regexString);
}

export function matchesMediaType(
  thyminReq: ThymianHttpRequest,
  mediaType: string,
): boolean;
export function matchesMediaType(
  thyminRes: ThymianHttpResponse,
  mediaType: string,
): boolean;
export function matchesMediaType(
  expected: ThymianHttpRequest | ThymianHttpResponse,
  mediaType: string,
): boolean {
  // if the media type of the request or response is empty or undefined, there is no request/response body and we simply return true
  return !expected.mediaType || !!is(mediaType, expected.mediaType);
}

export * from 'chalk';
export { deepmerge };
