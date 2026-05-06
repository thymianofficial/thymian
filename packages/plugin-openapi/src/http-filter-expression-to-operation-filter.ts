import type { HttpFilterExpression } from '@thymian/core';
import {
  createFilterVisitor,
  equalsIgnoreCase,
  visitHttpFilter,
} from '@thymian/core';
import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';

import type { ServerInfo } from './processors/extract-server-info.js';
import { resolveOpenApiReference } from './processors/openapi-reference-resolver.js';
import type { Parameters } from './processors/utils.js';

export type OperationObjectFilterFn = (args: {
  operationObject: OpenApiV31.OperationObject;
  params: Parameters;
  method: string;
  path: string;
  serverInfo: ServerInfo;
  document: OpenApiV31.Document;
}) => boolean;

function joinUrls(baseUrl: string, path: string): string {
  return (baseUrl + path).replace(/\/\//g, '/');
}

function hasQueryParam(params: Parameters, param: string): boolean {
  return Object.keys(params.queryParameters).some((p) =>
    equalsIgnoreCase(p, param),
  );
}

function hasRequestHeader(params: Parameters, header: string): boolean {
  return Object.keys(params.headers).some((h) => equalsIgnoreCase(h, header));
}

function hasResponseWithStatusCode(
  operationObject: OpenApiV31.OperationObject,
  code: number,
): boolean {
  if (!operationObject.responses) {
    return false;
  }

  return Object.keys(operationObject.responses).some((statusCode) => {
    if (statusCode === 'default') {
      return false;
    }
    return parseInt(statusCode, 10) === code;
  });
}

function hasResponseInStatusCodeRange(
  operationObject: OpenApiV31.OperationObject,
  start: number,
  end: number,
): boolean {
  if (!operationObject.responses) {
    return false;
  }

  return Object.keys(operationObject.responses).some((statusCode) => {
    if (statusCode === 'default') {
      return false;
    }
    const code = parseInt(statusCode, 10);
    return Number.isInteger(code) && code >= start && code <= end;
  });
}

function hasRequestBody(operationObject: OpenApiV31.OperationObject): boolean {
  return !!operationObject.requestBody;
}

function hasRequestMediaType(
  operationObject: OpenApiV31.OperationObject,
  mediaType: string,
  document: OpenApiV31.Document,
): boolean {
  if (!operationObject.requestBody) {
    return false;
  }

  const content = resolveOpenApiReference<OpenApiV31.RequestBodyObject>(
    operationObject.requestBody,
    document,
    'request body',
  ).content;

  if (!content) {
    return false;
  }

  return Object.keys(content).some((mt) => equalsIgnoreCase(mt, mediaType));
}

function hasResponseMediaType(
  operationObject: OpenApiV31.OperationObject,
  mediaType: string,
  document: OpenApiV31.Document,
): boolean {
  if (!operationObject.responses) {
    return false;
  }

  return Object.values(operationObject.responses).some((response) => {
    const resolvedResponse = resolveOpenApiReference<OpenApiV31.ResponseObject>(
      response,
      document,
      'response',
    );

    if (!resolvedResponse.content) {
      return false;
    }

    return Object.keys(resolvedResponse.content).some((mt) =>
      equalsIgnoreCase(mt, mediaType),
    );
  });
}

function hasResponseHeader(
  operationObject: OpenApiV31.OperationObject,
  header: string,
  document: OpenApiV31.Document,
): boolean {
  if (!operationObject.responses) {
    return false;
  }

  return Object.values(operationObject.responses).some((response) => {
    const resolvedResponse = resolveOpenApiReference<OpenApiV31.ResponseObject>(
      response,
      document,
      'response',
    );

    if (!resolvedResponse.headers) {
      return false;
    }

    return Object.keys(resolvedResponse.headers).some((h) =>
      equalsIgnoreCase(h, header),
    );
  });
}

function hasResponseBody(
  operationObject: OpenApiV31.OperationObject,
  document: OpenApiV31.Document,
): boolean {
  if (!operationObject.responses) {
    return false;
  }

  return Object.values(operationObject.responses).some((response) => {
    const resolvedResponse = resolveOpenApiReference<OpenApiV31.ResponseObject>(
      response,
      document,
      'response',
    );
    return (
      !!resolvedResponse.content &&
      Object.keys(resolvedResponse.content).length > 0
    );
  });
}

function isOperationSecured(
  operationObject: OpenApiV31.OperationObject,
  document: OpenApiV31.Document,
): boolean {
  if (operationObject.security) {
    return operationObject.security.length > 0;
  }

  if (document.security) {
    return document.security.length > 0;
  }

  return false;
}

const visitor = createFilterVisitor<OperationObjectFilterFn>({
  visitMethod({ method }) {
    if (typeof method === 'undefined') {
      return () => false;
    }
    return ({ method: m }) => equalsIgnoreCase(m, method);
  },
  visitRequestHeader({ header }) {
    if (typeof header === 'undefined') {
      return () => false;
    }
    return ({ params }) => hasRequestHeader(params, header);
  },
  visitQueryParam({ param }) {
    if (typeof param === 'undefined') {
      return () => false;
    }
    return ({ params }) => hasQueryParam(params, param);
  },
  visitPath({ path }) {
    if (typeof path === 'undefined') {
      return () => false;
    }

    return ({ path: p, serverInfo }) =>
      joinUrls(serverInfo.basePath, p).endsWith(path);
  },
  visitHasResponse({ filter }) {
    const nestedFilter = httpFilterExpressionToOperationFilter(filter);
    return (args) => nestedFilter(args);
  },
  visitIsAuthorized({ isAuthorized }) {
    return ({ operationObject, document }) =>
      isOperationSecured(operationObject, document) === isAuthorized;
  },
  visitOrigin({ origin }) {
    return ({ serverInfo }) => {
      return (
        `${serverInfo.protocol}://${serverInfo.host}:${serverInfo.port}` ===
        origin
      );
    };
  },
  visitHasBody({ hasBody }) {
    return ({ operationObject }) => hasRequestBody(operationObject) === hasBody;
  },
  visitPort({ port }) {
    return ({ serverInfo }) => serverInfo.port === port;
  },
  visitRequestMediaType({ mediaType }) {
    if (typeof mediaType === 'undefined') {
      return () => false;
    }

    return ({ operationObject, document }) =>
      hasRequestMediaType(operationObject, mediaType, document);
  },
  visitUrl({ url }) {
    return ({ serverInfo, path }) => {
      const fullUrl = `${serverInfo.protocol}://${serverInfo.host}:${
        serverInfo.port
      }${path.startsWith('/') ? path : '/' + path}`;
      return fullUrl === url;
    };
  },
  visitProtocol({ protocol }) {
    return ({ serverInfo }) => serverInfo.protocol === protocol;
  },
  visitStatusCode({ code }) {
    if (typeof code === 'undefined') {
      return () => false;
    }

    return ({ operationObject }) =>
      hasResponseWithStatusCode(operationObject, code);
  },
  visitHasResponseBody({ hasBody }) {
    return ({ operationObject, document }) =>
      hasResponseBody(operationObject, document) === hasBody;
  },
  visitResponseHeader({ header }) {
    if (typeof header === 'undefined') {
      return () => false;
    }
    return ({ operationObject, document }) =>
      hasResponseHeader(operationObject, header, document);
  },
  visitStatusCodeRange({ start, end }) {
    return ({ operationObject }) =>
      hasResponseInStatusCodeRange(operationObject, start, end);
  },
  visitResponseMediaType({ mediaType }) {
    if (typeof mediaType === 'undefined') {
      return () => false;
    }

    return ({ operationObject, document }) =>
      hasResponseMediaType(operationObject, mediaType, document);
  },
  visitResponseTrailer() {
    throw new Error('Response trailers are not currently supported.');
  },
});

export function httpFilterExpressionToOperationFilter(
  expression: HttpFilterExpression,
): OperationObjectFilterFn {
  return visitHttpFilter(expression, visitor);
}
