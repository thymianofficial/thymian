import { beforeEach, describe, expect, it, vitest } from 'vitest';

import {
  NoopLogger,
  PluginRegistrationError,
  type SpecValidationResult,
  Thymian,
  ThymianFormat,
  type ThymianPlugin,
  ThymianPluginFn,
} from '../src/index.js';

declare module '../src/events/index.js' {
  interface ThymianEvents {
    [event: string]: unknown;
  }
}

declare module '../src/actions/index.js' {
  interface ThymianActions {
    [action: string]: {
      event: unknown;
      response: unknown;
    };
  }
}

const plugin: ThymianPlugin = {
  name: '',
  version: '',
  plugin: () => Promise.resolve(),
};

function createPluginFor(
  plugin: ThymianPluginFn<{ cwd: string }>,
): ThymianPlugin {
  return {
    name: '',
    version: '',
    plugin,
  };
}

describe('Thymian', () => {
  let thymian: Thymian;

  beforeEach(() => {
    thymian = new Thymian(new NoopLogger());
  });

  it('should emit register event', async () => {
    const a = vitest.fn();

    thymian.register({
      name: '',
      version: '',
      plugin: async (emitter) => {
        emitter.on('core.register', a);
      },
    });

    await thymian.register(plugin).register(plugin).register(plugin).ready();

    expect(a).toHaveBeenCalledTimes(3);
  });

  it('should register plugins correctly', async () => {
    const a = vitest.fn();
    const b = vitest.fn();

    thymian.register({
      name: '',
      version: '',
      plugin: async (emitter) => {
        emitter.onAction('core.lint', (_payload, ctx) => {
          emitter.emit('test', 1);
          emitter.emit('event', 'turing');
          ctx.reply({
            source: 'test-plugin',
            status: 'success',
            violations: [],
          });
        });
      },
    });

    thymian.register({
      name: '',
      version: '',
      plugin: async (emitter) => {
        emitter.on('test', a);
      },
    });

    thymian.register<{ event: string }>(
      {
        name: '',
        version: '',
        plugin: async (emitter, logger, opts) => {
          emitter.on(opts.event, b);
        },
      },
      {
        event: 'event',
      },
    );

    await thymian.run(async () => {
      await thymian.emitter.emitAction('core.lint', {
        format: new ThymianFormat().export(),
        rules: [],
        rulesConfig: {},
      });
    });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  // TODO: make test independent from package.json version
  it('register should throw for plugin version mismatch', () => {
    expect(() =>
      thymian.register({
        name: '@thymian/test-plugin',
        plugin: () => Promise.resolve(),
        version: '1.x',
      }),
    ).toThrowError(PluginRegistrationError);
  });

  it('should call close action before rejecting promise for error event', async () => {
    const closedSpy = vitest.fn();

    thymian.register(
      createPluginFor(async (emitter) => {
        emitter.onAction('core.close', (_, ctx) => {
          closedSpy();
          ctx.reply();
        });
      }),
    );

    thymian.register(
      createPluginFor(async (emitter) => {
        emitter.onAction('core.lint', (_, ctx) => {
          ctx.error({
            message: 'Error event!',
            name: 'MyError',
            options: {
              severity: 'error',
            },
          });
        });
      }),
    );

    try {
      await thymian.run(async () => {
        await thymian.emitter.emitAction('core.lint', {
          format: new ThymianFormat().export(),
          rules: [],
          rulesConfig: {},
        });
      });
      expect.fail('Thymian should have rejected the promise.');
    } catch (err) {
      expect(closedSpy).toHaveBeenCalled();
      expect(err).toMatchObject({
        message: 'Error event!',
      });
    }
  });

  describe('validation workflows', () => {
    it('validate should collect dedicated spec validation results', async () => {
      const validateSpy = vitest.fn();

      thymian.register(
        createPluginFor(async (emitter) => {
          emitter.onAction('core.validate-specs', (payload, ctx) => {
            validateSpy(payload);
            ctx.reply([
              {
                type: 'openapi',
                location: '/tmp/api.yaml',
                source: 'api.yaml',
                status: 'success',
                issues: [],
              } satisfies SpecValidationResult,
            ]);
          });
        }),
      );

      await thymian.ready();

      const result = await thymian.validate({
        specification: [{ type: 'openapi', location: '/tmp/api.yaml' }],
      });

      expect(validateSpy).toHaveBeenCalledWith({
        inputs: [{ type: 'openapi', location: '/tmp/api.yaml' }],
      });
      expect(result).toEqual({
        classification: 'clean-run',
        results: [
          {
            type: 'openapi',
            location: '/tmp/api.yaml',
            source: 'api.yaml',
            status: 'success',
            issues: [],
          },
        ],
      });
    });

    it('validate should classify unsupported spec types as tool errors', async () => {
      await thymian.ready();

      const result = await thymian.validate({
        specification: [{ type: 'asyncapi', location: '/tmp/api.yaml' }],
      });

      expect(result.classification).toBe('tool-error');
      expect(result.results).toEqual([
        expect.objectContaining({
          type: 'asyncapi',
          location: '/tmp/api.yaml',
          status: 'unsupported',
          issues: [
            {
              message:
                'No validator registered for specification type "asyncapi".',
            },
          ],
        }),
      ]);
    });

    it('lint should load specification inputs and dispatch through the core entrypoint', async () => {
      const formatLoadSpy = vitest.fn();
      const coreLintSpy = vitest.fn();

      thymian.register(
        createPluginFor(async (emitter) => {
          emitter.onAction('core.format.load', (input, ctx) => {
            formatLoadSpy(input);

            const format = new ThymianFormat();
            format.addHttpTransaction(
              {
                type: 'http-request',
                host: 'localhost',
                port: 8080,
                protocol: 'http',
                path: '/lint',
                method: 'get',
                headers: {},
                queryParameters: {},
                cookies: {},
                pathParameters: {},
                mediaType: '',
              },
              {
                type: 'http-response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 200,
              },
              'spec-loader',
            );

            ctx.reply(format.export());
          });

          emitter.onAction('core.lint', (payload, ctx) => {
            coreLintSpy(payload);
            ctx.reply({
              source: '@thymian/plugin-http-linter',
              status: 'success',
              violations: [],
            });
          });

          emitter.onAction('core.report.flush', (_, ctx) => {
            ctx.reply({ text: 'lint report' });
          });
        }),
      );

      await thymian.ready();

      const result = await thymian.lint({
        specification: [{ type: 'openapi', location: '/tmp/api.yaml' }],
        rulesConfig: { demo: 'warn' },
        options: { source: 'test' },
      });

      expect(formatLoadSpy).toHaveBeenCalledWith({
        inputs: [{ type: 'openapi', location: '/tmp/api.yaml' }],
        validateSpecs: false,
      });
      expect(coreLintSpy).toHaveBeenCalledTimes(1);
      expect(coreLintSpy.mock.calls[0]?.[0]).toMatchObject({
        rules: [],
        rulesConfig: { demo: 'warn' },
        options: { source: 'test' },
      });
      expect(coreLintSpy.mock.calls[0]?.[0].format).toBeDefined();
      expect(result).toEqual({
        classification: 'clean-run',
        text: 'lint report',
        results: [
          {
            source: '@thymian/plugin-http-linter',
            status: 'success',
            violations: [],
          },
        ],
      });
    });

    it('test should load specification inputs and dispatch through the core entrypoint', async () => {
      const formatLoadSpy = vitest.fn();
      const coreTestSpy = vitest.fn();

      thymian.register(
        createPluginFor(async (emitter) => {
          emitter.onAction('core.format.load', (input, ctx) => {
            formatLoadSpy(input);
            ctx.reply(new ThymianFormat().export());
          });

          emitter.onAction('core.test', (payload, ctx) => {
            coreTestSpy(payload);
            ctx.reply({
              source: '@thymian/plugin-http-tester',
              status: 'failed',
              violations: [
                {
                  ruleName: 'demo/test-rule',
                  severity: 'warn',
                  violation: { location: 'request' },
                },
              ],
            });
          });

          emitter.onAction('core.report.flush', (_, ctx) => {
            ctx.reply({ text: 'test report' });
          });
        }),
      );

      await thymian.ready();

      const result = await thymian.test({
        specification: [{ type: 'openapi', location: '/tmp/api.yaml' }],
        options: { replay: false },
      });

      expect(formatLoadSpy).toHaveBeenCalledWith({
        inputs: [{ type: 'openapi', location: '/tmp/api.yaml' }],
        validateSpecs: false,
      });
      expect(coreTestSpy).toHaveBeenCalledTimes(1);
      expect(coreTestSpy.mock.calls[0]?.[0]).toMatchObject({
        rules: [],
        rulesConfig: undefined,
        options: { replay: false },
      });
      expect(result).toEqual({
        classification: 'findings',
        text: 'test report',
        results: [
          {
            source: '@thymian/plugin-http-tester',
            status: 'failed',
            violations: [
              {
                ruleName: 'demo/test-rule',
                severity: 'warn',
                violation: { location: 'request' },
              },
            ],
          },
        ],
      });
    });

    it('analyze should merge traffic, optionally load format, and dispatch through the core entrypoint', async () => {
      const formatLoadSpy = vitest.fn();
      const trafficLoadSpy = vitest.fn();
      const coreAnalyzeSpy = vitest.fn();

      thymian.register(
        createPluginFor(async (emitter) => {
          emitter.onAction('core.format.load', (input, ctx) => {
            formatLoadSpy(input);
            ctx.reply(new ThymianFormat().export());
          });

          emitter.onAction('core.traffic.load', (input, ctx) => {
            trafficLoadSpy(input);
            ctx.reply({
              transactions: [
                {
                  request: {
                    data: {
                      method: 'get',
                      origin: 'https://api.example.com',
                      path: '/users/1',
                      headers: {},
                    },
                    meta: {},
                  },
                  response: {
                    data: {
                      statusCode: 200,
                      headers: {},
                      trailers: {},
                      duration: 0,
                    },
                    meta: {},
                  },
                },
              ],
              traces: [{ id: 'trace-1' }],
              metadata: { pluginA: true },
            });
          });

          emitter.onAction('core.analyze', (payload, ctx) => {
            coreAnalyzeSpy(payload);
            ctx.reply({
              source: '@thymian/plugin-http-analyzer',
              status: 'success',
              violations: [],
            });
          });

          emitter.onAction('core.report.flush', (_, ctx) => {
            ctx.reply({ text: 'analyze report' });
          });
        }),
      );

      thymian.register(
        createPluginFor(async (emitter) => {
          emitter.onAction('core.traffic.load', (_, ctx) => {
            ctx.reply({
              transactions: [
                {
                  request: {
                    data: {
                      method: 'post',
                      origin: 'https://api.example.com',
                      path: '/users',
                      headers: {},
                    },
                    meta: {},
                  },
                  response: {
                    data: {
                      statusCode: 201,
                      headers: {},
                      trailers: {},
                      duration: 0,
                    },
                    meta: {},
                  },
                },
              ],
              traces: [{ id: 'trace-2' }],
              metadata: { pluginB: true },
            });
          });
        }),
      );

      await thymian.ready();

      const result = await thymian.analyze({
        specification: [{ type: 'openapi', location: '/tmp/api.yaml' }],
        traffic: [{ type: 'har', location: '/tmp/traffic.har' }],
        options: { includeTraces: true },
      });

      expect(trafficLoadSpy).toHaveBeenCalledWith({
        inputs: [{ type: 'har', location: '/tmp/traffic.har' }],
      });
      expect(formatLoadSpy).toHaveBeenCalledWith({
        inputs: [{ type: 'openapi', location: '/tmp/api.yaml' }],
        validateSpecs: false,
      });
      expect(coreAnalyzeSpy).toHaveBeenCalledTimes(1);
      expect(coreAnalyzeSpy.mock.calls[0]?.[0]).toMatchObject({
        options: { includeTraces: true },
        rules: [],
        traffic: {
          metadata: { pluginA: true, pluginB: true },
        },
      });
      expect(
        coreAnalyzeSpy.mock.calls[0]?.[0].traffic.transactions,
      ).toHaveLength(2);
      expect(coreAnalyzeSpy.mock.calls[0]?.[0].traffic.traces).toHaveLength(2);
      expect(coreAnalyzeSpy.mock.calls[0]?.[0].format).toBeDefined();
      expect(result).toEqual({
        classification: 'clean-run',
        text: 'analyze report',
        results: [
          {
            source: '@thymian/plugin-http-analyzer',
            status: 'success',
            violations: [],
          },
        ],
      });
    });
  });
});
