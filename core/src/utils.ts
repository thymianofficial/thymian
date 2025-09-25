import deepmerge from '@fastify/deepmerge';
import {
  httpStatusCodeToPhrase,
  isValidHttpStatusCode,
} from '@thymian/http-status-codes';

import type {
  ThymianHttpRequest,
  ThymianHttpResponse,
} from './format/index.js';
import type { HttpRequest, HttpResponse } from './http.js';

export function timeoutPromise<T>(
  promise: Promise<T>,
  toWait = 5000,
  err?: Error
): Promise<T> {
  let timoutId: NodeJS.Timeout;

  return Promise.race<T>([
    promise,
    new Promise((_, reject) => {
      timoutId = setTimeout(
        () => reject(err ?? new Error(`Promise timed out after ${toWait} ms.`)),
        toWait
      );
    }),
  ]).finally(() => clearTimeout(timoutId));
}

export function isRecord(
  value: unknown
): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && !Array.isArray(value) && value !== null;
}

export function matchObjects(source: unknown, target: unknown): boolean {
  if (!isRecord(source) || !isRecord(target)) return false;

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
  [P in keyof T as T[P] extends (string | undefined) | (number | undefined)
    ? P
    : never]: P;
};

export type StringAndNumberProperties<T> = Partial<{
  [key in KeysWithStringOrNumberValue<T>]: T[key];
}>;

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

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
  headerName: string
): string | string[] | undefined {
  const headerNames = Object.keys(headers);

  const found = headerNames.find(
    (name) => name.toLowerCase() === headerName.toLowerCase()
  );

  if (found) {
    return headers[found];
  }

  return undefined;
}

export function setHeader(
  headers: Record<string, unknown>,
  headerName: string,
  value: unknown
): Record<string, unknown> {
  const headerNames = Object.keys(headers);

  const found = headerNames.find(
    (name) => name.toLowerCase() === headerName.toLowerCase()
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

export function thymianRequestToString(req: ThymianHttpRequest): string {
  const title = `${req.method.toUpperCase()} ${req.path}`;

  return req.mediaType ? title + ` - ${req.mediaType}` : title;
}

export function thymianResponseToString(res: ThymianHttpResponse): string {
  const statusCode = res.statusCode;
  const phrase = isValidHttpStatusCode(statusCode)
    ? httpStatusCodeToPhrase[statusCode]
    : '';

  const title = `${statusCode} ${phrase.toUpperCase()}`;

  return res.mediaType ? title + ` - ${res.mediaType}` : title;
}

export function thymianHttpTransactionToString(
  req: ThymianHttpRequest,
  res: ThymianHttpResponse
): string {
  return `${thymianRequestToString(req)} \u2192 ${thymianResponseToString(
    res
  )}`;
}

export function equalsIgnoreCase(a: string, ...b: string[]): boolean {
  return b.some(
    (str) => a.localeCompare(str, undefined, { sensitivity: 'accent' }) === 0
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
  defaultValue = ''
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

  return url.toString();
}

export function httpRequestToLabel(request: HttpRequest): string {
  return `${request.method.toUpperCase()} ${new URL(
    request.path,
    request.origin
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

export * from 'chalk';
export { deepmerge };
