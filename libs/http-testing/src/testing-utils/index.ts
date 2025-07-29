import type { HttpTestContext, HttpTestHooks } from '../http-test/index.js';

export const exampleContentGenerator: HttpTestContext['generateContent'] =
  async (schema) => {
    if (typeof schema === 'boolean') {
      return { content: {} };
    } else {
      return { content: schema.examples?.[0] };
    }
  };

export const identityHookRunner: HttpTestContext['runHook'] = async (
  name,
  payload
) => {
  return {
    value: payload.value,
  } as HttpTestHooks[typeof name]['return'];
};
