import type { Parameter } from '@thymian/core';

import type { HttpTestContext, HttpTestHooks } from '../http-test/index.js';

export const exampleRequestSampler: HttpTestContext['sampleRequest'] = async (
  transaction,
) => {
  return {
    authorize: true,
    body: transaction.thymianReq.body?.examples?.[0],
    cookies: generateExampleParameters(transaction.thymianReq.cookies),
    headers: generateExampleParameters(transaction.thymianReq.headers),
    method: transaction.thymianReq.method,
    origin: `${transaction.thymianReq.protocol}://${transaction.thymianReq.host}:${transaction.thymianReq.port}`,
    path: transaction.thymianReq.path,
    pathParameters: generateExampleParameters(
      transaction.thymianReq.pathParameters,
    ),
    query: generateExampleParameters(transaction.thymianReq.queryParameters),
  };
};

export function generateExampleParameters(
  parameters: Record<string, Parameter>,
): Record<string, unknown> {
  return Object.entries(parameters).reduce((acc, [name, param]) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    acc[name] = param.schema.examples?.[0];

    return acc;
  }, {});
}

export const identityHookRunner: HttpTestContext['runHook'] = async (
  name,
  payload,
) => {
  return {
    value: payload.value,
  } as HttpTestHooks[typeof name]['return'];
};
