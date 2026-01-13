import {
  type HttpRequest,
  type HttpRequestTemplate,
  type HttpResponse,
  type Logger,
  ThymianEmitter,
  ThymianFormat,
  type ThymianHttpTransaction,
} from '@thymian/core';
import {
  createHttpTestContext,
  createHttpTestHookRunnerFromThymianEmitter,
} from '@thymian/http-testing';

export function createContext(
  format: ThymianFormat,
  logger: Logger,
  emitter: ThymianEmitter,
) {
  return createHttpTestContext({
    format,
    logger,
    locals: {},
    sampleRequest: async function (
      transaction: ThymianHttpTransaction,
    ): Promise<HttpRequestTemplate> {
      return await emitter.emitAction(
        'sampler.sample-request',
        { transaction },
        { strategy: 'first' },
      );
    },
    runRequest: async function (request: HttpRequest): Promise<HttpResponse> {
      return await emitter.emitAction(
        'request-dispatcher.http-request',
        {
          request,
        },
        {
          strategy: 'first',
        },
      );
    },
    runHook: createHttpTestHookRunnerFromThymianEmitter(emitter),
  });
}
