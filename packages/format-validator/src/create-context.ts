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
  origin?: string,
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
    runRequest: async function (req: HttpRequest): Promise<HttpResponse> {
      const finalOrigin = origin ?? req.origin;
      return await emitter.emitAction(
        'request-dispatcher.http-request',
        {
          request: {
            ...req,
            origin: finalOrigin,
          },
        },
        {
          strategy: 'first',
        },
      );
    },
    runHook: createHttpTestHookRunnerFromThymianEmitter(emitter),
  });
}
