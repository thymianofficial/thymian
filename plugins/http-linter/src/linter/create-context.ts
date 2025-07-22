import {
  type HttpRequest,
  type HttpResponse,
  type Logger,
  ThymianEmitter,
  ThymianFormat,
  type ThymianSchema,
} from '@thymian/core';
import {
  createHttpTestContext,
  type HttpTestCase,
  type HttpTestCaseStep,
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
    runHook: async function <
      Steps extends HttpTestCaseStep[] = HttpTestCaseStep[]
    >(
      name: string,
      testCase: HttpTestCase<Steps>
    ): Promise<HttpTestCase<Steps>> {
      return (await emitter.emitAction(
        'http-testing.test-hook',
        { name, testCase },
        {
          strategy: 'deep-merge',
        }
      )) as HttpTestCase<Steps>;
    },
  });
}
