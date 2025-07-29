import {
  type HttpRequest,
  type HttpResponse,
  type Logger,
  ThymianEmitter,
  ThymianFormat,
  type ThymianSchema,
} from '@thymian/core';
import { createHookRunner, createHttpTestContext } from '@thymian/http-testing';

export function createContext(
  format: ThymianFormat,
  logger: Logger,
  emitter: ThymianEmitter,
  origin?: string
) {
  return createHttpTestContext({
    format,
    logger,
    locals: {},
    auth: {
      basic: async () => ['matthyk', 'qupaya'],
    },
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
