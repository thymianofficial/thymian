import {
  type HttpRequest,
  type HttpRequestTemplate,
  type HttpResponse,
  type Logger,
  ThymianEmitter,
  ThymianFormat,
  type ThymianHttpTransaction,
  type ThymianSchema,
} from '@thymian/core';
import {
  createHookRunner,
  createHttpTestContext,
  type HttpTestContextLocals,
} from '@thymian/http-testing';

export function createContext<Locals extends HttpTestContextLocals>(
  format: ThymianFormat,
  logger: Logger,
  emitter: ThymianEmitter,
  origin?: string,
  locals: Locals = {} as Locals
) {
  return createHttpTestContext({
    format,
    logger,
    locals,
    sampleRequest: function (
      transaction: ThymianHttpTransaction
    ): Promise<HttpRequestTemplate> {
      return emitter.emitAction(
        'sampler.sample-request',
        { transaction },
        { strategy: 'first' }
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
        }
      );
    },
    runHook: createHookRunner(emitter),
  });
}
