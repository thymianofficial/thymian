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
  type HttpTestContextLocals,
} from '@thymian/core';

export function createContext<Locals extends HttpTestContextLocals>(
  format: ThymianFormat,
  logger: Logger,
  emitter: ThymianEmitter,
  origin?: string,
  locals: Locals = {} as Locals,
) {
  return createHttpTestContext({
    format,
    logger,
    locals,
    sampleRequest: async function (
      transaction: ThymianHttpTransaction,
    ): Promise<HttpRequestTemplate> {
      return await emitter.emitAction(
        'core.request.sample',
        { transaction },
        { strategy: 'first' },
      );
    },
    runRequest: async function (req: HttpRequest): Promise<HttpResponse> {
      const finalOrigin = origin ?? req.origin;
      return await emitter.emitAction(
        'core.request.dispatch',
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
