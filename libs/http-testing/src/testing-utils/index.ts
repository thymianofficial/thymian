import type { HttpTestContext } from '../http-test/index.js';

export const exampleContentGenerator: HttpTestContext['generateContent'] =
  async (schema) => {
    if (typeof schema === 'boolean') {
      return { content: {} };
    } else {
      return { content: schema.examples?.[0] };
    }
  };

export const identityHookRunner: HttpTestContext['runHook'] = async (a, b) =>
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  b.value;
