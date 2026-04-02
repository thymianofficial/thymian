import type { Parameter } from '@thymian/core';

export type Parameters = {
  headers: Record<string, Parameter>;
  cookies: Record<string, Parameter>;
  pathParameters: Record<string, Parameter>;
  queryParameters: Record<string, Parameter>;
};

export function mergeParameters(from: Parameters, to: Parameters): Parameters {
  return {
    cookies: {
      ...from.cookies,
      ...to.cookies,
    },
    pathParameters: {
      ...from.pathParameters,
      ...to.pathParameters,
    },
    queryParameters: {
      ...from.queryParameters,
      ...to.queryParameters,
    },
    headers: {
      ...from.headers,
      ...to.headers,
    },
  };
}
