import {
  type DeepPartial,
  type HttpResponse,
  type ThymianActions,
  ThymianEmitter,
} from '@thymian/core';
import { deepmerge } from '@thymian/core/utils';

import type { HttpRequestTemplate } from '../http-request-template.js';
import type { HttpTestContext } from './http-test-context.js';
import type {
  HttpTestHookArg,
  HttpTestHookReturnType,
  HttpTestHooks,
} from './http-test-hooks.js';

declare module '@thymian/core' {
  interface ThymianActions {
    'http-testing.beforeRequest': {
      event: HttpTestHookArg<HttpRequestTemplate>;
      response: HttpTestHookReturnType<DeepPartial<HttpRequestTemplate>>;
    };

    'http-testing.afterResponse': {
      event: HttpTestHookArg<HttpResponse>;
      response: HttpTestHookReturnType<DeepPartial<HttpResponse>>;
    };

    'http-testing.authorize': {
      event: {
        value: HttpRequestTemplate;
      };
      response: {
        value: HttpRequestTemplate;
      };
    };
  }
}

const dm = deepmerge();

export function createHookRunner(
  emitter: ThymianEmitter
): HttpTestContext['runHook'] {
  // TODO
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return async function runHook(name, payload) {
    const actionName: `http-testing.${keyof HttpTestHooks}` = `http-testing.${name}`;

    const result = (await emitter.emitAction(actionName, payload, {
      strategy: 'deep-merge',
    })) as ThymianActions[typeof actionName]['response'];

    const value = dm(payload.value, result.value ?? {});

    return {
      ...result,
      value,
    };
  };
}
