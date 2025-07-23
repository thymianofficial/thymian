// from https://github.com/fastify/fastify/blob/c277b9f0ec27356de6551d7777117bd739057e99/types/utils.d.ts#L90
import * as http from 'node:http';

type OmitIndexSignature<T> = {
  [K in keyof T as string extends K
    ? never
    : number extends K
    ? never
    : K]: T[K];
};

// from https://github.com/fastify/fastify/blob/c277b9f0ec27356de6551d7777117bd739057e99/types/utils.d.ts#L98
export type HttpHeader =
  | keyof OmitIndexSignature<http.OutgoingHttpHeaders>
  | (string & Record<never, never>);

export type HttpMethod =
  | 'DELETE'
  | 'GET'
  | 'HEAD'
  | 'PATCH'
  | 'POST'
  | 'PUT'
  | 'OPTIONS'
  | (string & {});

export type RequestFilterExpression =
  | { type: 'method'; method: string }
  | { type: 'hasRequestHeader'; header: string }
  | { type: 'hasQueryParam'; param: string }
  | { type: 'path'; path: string }
  | { type: 'hasResponses'; filters: HttpFilterExpression[] }
  | { type: 'isAuthorized'; isAuthorized: boolean };

export type ResponseFilterExpression =
  | { type: 'statusCode'; code: number }
  | { type: 'hasResponseBody'; hasBody: boolean }
  | { type: 'responseHeader'; header: string }
  | { type: 'statusCodeRange'; start: number; end: number };

export type LogicalExpression =
  | { type: 'and'; filters: HttpFilterExpression[] }
  | { type: 'or'; filters: HttpFilterExpression[] }
  | { type: 'not'; filter: HttpFilterExpression }
  | { type: 'xor'; filters: [HttpFilterExpression, HttpFilterExpression] };

export type HttpFilterExpression =
  | RequestFilterExpression
  | ResponseFilterExpression
  | LogicalExpression;

export const methods = (...methods: HttpMethod[]): LogicalExpression => ({
  type: 'or',
  filters: methods.map((method) => ({ type: 'method', method })),
});

export const method = (method: HttpMethod): RequestFilterExpression => ({
  type: 'method',
  method,
});

export const path = (path: string): RequestFilterExpression => ({
  type: 'path',
  path,
});

export const responseHeader = (
  header: HttpHeader
): RequestFilterExpression | ResponseFilterExpression => ({
  type: 'responseHeader',
  header,
});

export const requestHeader = (
  header: HttpHeader
): RequestFilterExpression | ResponseFilterExpression => ({
  type: 'hasRequestHeader',
  header,
});

export const statusCode = (code: number): ResponseFilterExpression => ({
  type: 'statusCode',
  code,
});

export const statusCodeRange = (
  start: number,
  end: number
): ResponseFilterExpression => ({
  type: 'statusCodeRange',
  start,
  end,
});

export const hasResponseBody = (hasBody = true): ResponseFilterExpression => ({
  type: 'hasResponseBody',
  hasBody,
});

export const and = (...filters: HttpFilterExpression[]): LogicalExpression => ({
  type: 'and',
  filters,
});

export const or = (...filters: HttpFilterExpression[]): LogicalExpression => ({
  type: 'or',
  filters,
});

export const not = (filter: HttpFilterExpression): LogicalExpression => ({
  type: 'not',
  filter,
});

export const xor = (
  ...filters: [HttpFilterExpression, HttpFilterExpression]
): LogicalExpression => ({
  type: 'xor',
  filters,
});
export const isAuthorized = (isAuthorized = true): RequestFilterExpression => ({
  type: 'isAuthorized',
  isAuthorized,
});

export const hasResponses = (
  filters: HttpFilterExpression[]
): RequestFilterExpression => ({
  type: 'hasResponses',
  filters,
});

export function responseWith(
  ...filters: (ResponseFilterExpression | LogicalExpression)[]
): LogicalExpression {
  return and(...filters);
}

export function requestWith(
  ...filters: (RequestFilterExpression | LogicalExpression)[]
): LogicalExpression {
  return and(...filters);
}

export function httpFilter(
  ...expressions: HttpFilterExpression[]
): HttpFilterExpression {
  console.log(expressions);
  if (expressions.length === 0) {
    return {
      type: 'and',
      filters: [],
    };
  } else if (expressions[0]) {
    return expressions[0];
  } else {
    return and(...expressions);
  }
}

and(method('GET'), statusCode(201));
