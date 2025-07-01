import type { HttpTestContext } from '../http-test-context.js';

export * from './create-request-runner.js';

export const exampleContentGenerator: HttpTestContext['generateContent'] =
  async (schema) => {
    if (typeof schema === 'boolean') {
      return { content: {} };
    } else {
      return { content: schema.examples?.[0] };
    }
  };

export const identityHookRunner: HttpTestContext['runHook'] = async <
  Input,
  Output
>(
  _: string,
  x: Input
) => x as unknown as Output;
