import {
  type HttpRequest,
  type HttpResponse,
  type Logger,
  ThymianEmitter,
  ThymianFormat,
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
    generateContent: async function (
      schema: ThymianSchema,
      contentType?: string
    ): Promise<{ content: unknown; encoding?: string }> {
      return await emitter.emitAction(
        'sampler.generate',
        {
          contentType: contentType ?? 'application/json',
          schema,
        },
        {
          strategy: 'first',
        }
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
