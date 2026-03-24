import { ThymianEmitter } from '../../index.js';
import { deepmerge } from '../../utils.js';
import type { HttpTestContext } from './http-test-context.js';
import type { HttpTestHooks } from './http-test-hooks.js';

declare module '@thymian/core' {
  interface ThymianActions {
    'http-testing.beforeRequest': {
      event: HttpTestHooks['beforeRequest']['arg'];
      response: HttpTestHooks['beforeRequest']['return'];
    };

    'http-testing.afterResponse': {
      event: HttpTestHooks['afterResponse']['arg'];
      response: HttpTestHooks['afterResponse']['return'];
    };

    'http-testing.authorize': {
      event: HttpTestHooks['authorize']['arg'];
      response: HttpTestHooks['authorize']['return'];
    };
  }
}

const dm = deepmerge();

export function createHttpTestHookRunnerFromThymianEmitter(
  emitter: ThymianEmitter,
): HttpTestContext['runHook'] {
  return async function runHook(name, payload) {
    const actionName: `http-testing.${keyof HttpTestHooks}` = `http-testing.${name}`;

    const result = await emitter.emitAction(actionName, payload, {
      strategy: 'deep-merge',
    });

    const value = dm(payload, result.result ?? {});

    return {
      ...result,
      value,
    };
  };
}
