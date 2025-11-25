import * as http from 'node:http';

type OmitIndexSignature<T> = {
  [K in keyof T as string extends K
    ? never
    : number extends K
      ? never
      : K]: T[K];
};

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
  | { type: 'method'; kind: 'request'; method?: string }
  | { type: 'requestHeader'; kind: 'request'; header?: string; value?: unknown }
  | { type: 'queryParam'; kind: 'request'; param?: string; value?: unknown }
  | { type: 'path'; kind: 'request'; path?: string }
  | {
      type: 'hasResponse';
      kind: 'request';
      filter: HttpFilterExpression;
    }
  | { type: 'isAuthorized'; kind: 'request'; isAuthorized: boolean }
  | { type: 'origin'; kind: 'request'; origin?: string }
  | { type: 'hasBody'; kind: 'request'; hasBody?: boolean }
  | { type: 'port'; kind: 'request'; port?: number }
  | { type: 'requestMediaType'; kind: 'request'; mediaType?: string }
  | { type: 'url'; kind: 'request'; url?: string };

export type ResponseFilterExpression =
  | { type: 'statusCode'; kind: 'response'; code?: number }
  | { type: 'hasResponseBody'; kind: 'response'; hasBody?: boolean }
  | {
      type: 'responseHeader';
      kind: 'response';
      header?: string;
      value?: unknown;
    }
  | { type: 'statusCodeRange'; kind: 'response'; start: number; end: number }
  | { type: 'responseMediaType'; kind: 'response'; mediaType?: string }
  | {
      type: 'responseTrailer';
      kind: 'response';
      trailer?: string;
      value?: unknown;
    };

export type LogicalExpression =
  | { type: 'and'; kind: 'logic'; filters: HttpFilterExpression[] }
  | { type: 'or'; kind: 'logic'; filters: HttpFilterExpression[] }
  | { type: 'not'; kind: 'logic'; filter: HttpFilterExpression }
  | Constant
  | {
      type: 'xor';
      kind: 'logic';
      filters: [HttpFilterExpression, HttpFilterExpression];
    };

export type Constant = { type: 'constant'; kind: 'logic'; value: unknown };

export type HttpFilterExpression =
  | RequestFilterExpression
  | ResponseFilterExpression
  | LogicalExpression;

export const methods = (...methods: HttpMethod[]): LogicalExpression => ({
  type: 'or',
  kind: 'logic',
  filters: methods.map((method) => ({
    type: 'method',
    kind: 'request',
    method,
  })),
});

export const method = (method?: HttpMethod): RequestFilterExpression => ({
  type: 'method',
  kind: 'request',
  method,
});

export const path = (path?: string): RequestFilterExpression => ({
  type: 'path',
  kind: 'request',
  path,
});

export const responseHeader = (
  header?: HttpHeader,
  value?: unknown,
): ResponseFilterExpression => ({
  type: 'responseHeader',
  kind: 'response',
  header,
  value,
});

export const responseTrailer = (
  trailer?: string,
  value?: unknown,
): ResponseFilterExpression => ({
  type: 'responseTrailer',
  kind: 'response',
  trailer,
  value,
});

export const requestHeader = (
  header: HttpHeader,
  value?: unknown,
): RequestFilterExpression => ({
  type: 'requestHeader',
  kind: 'request',
  header,
  value,
});

export const statusCode = (code?: number): ResponseFilterExpression => ({
  type: 'statusCode',
  code,
  kind: 'response',
});

export const statusCodeRange = (
  start: number,
  end: number,
): ResponseFilterExpression => ({
  kind: 'response',
  type: 'statusCodeRange',
  start,
  end,
});

export const hasResponseBody = (hasBody = true): ResponseFilterExpression => ({
  type: 'hasResponseBody',
  kind: 'response',

  hasBody,
});

export const and = (...filters: HttpFilterExpression[]): LogicalExpression => ({
  type: 'and',
  kind: 'logic',
  filters,
});

export const or = (...filters: HttpFilterExpression[]): LogicalExpression => ({
  type: 'or',
  kind: 'logic',
  filters,
});

export const not = (filter: HttpFilterExpression): LogicalExpression => ({
  type: 'not',
  kind: 'logic',
  filter,
});

export const xor = (
  ...filters: [HttpFilterExpression, HttpFilterExpression]
): LogicalExpression => ({
  type: 'xor',
  kind: 'logic',
  filters,
});

export const authorization = (
  isAuthorized = true,
): RequestFilterExpression => ({
  type: 'isAuthorized',
  kind: 'request',
  isAuthorized,
});

export const responseWith = (
  filter: HttpFilterExpression,
): RequestFilterExpression => ({
  type: 'hasResponse',
  kind: 'request',
  filter,
});

export const constant = (value?: unknown): Constant => ({
  type: 'constant',
  kind: 'logic',
  value,
});

export const origin = (origin?: string): RequestFilterExpression => ({
  type: 'origin',
  kind: 'request',
  origin,
});

export const hasRequestBody = (hasBody = true): RequestFilterExpression => ({
  type: 'hasBody',
  kind: 'request',
  hasBody,
});

export const port = (port?: number): RequestFilterExpression => ({
  type: 'port',
  kind: 'request',
  port,
});

export const requestMediaType = (
  mediaType: string,
): RequestFilterExpression => ({
  type: 'requestMediaType',
  kind: 'request',
  mediaType,
});

export const responseMediaType = (
  mediaType: string,
): ResponseFilterExpression => ({
  type: 'responseMediaType',
  kind: 'response',
  mediaType,
});

export const queryParameter = (
  name?: string,
  value?: unknown,
): RequestFilterExpression => ({
  type: 'queryParam',
  kind: 'request',
  param: name,
  value,
});

export const url = (url?: string): RequestFilterExpression => ({
  type: 'url',
  kind: 'request',
  url,
});

export const successfulStatusCode = () => statusCodeRange(200, 299);
