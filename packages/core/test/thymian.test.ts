import { beforeEach, describe, expect, it, vitest } from 'vitest';

import {
  NoopLogger,
  PluginRegistrationError,
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
        emitter.onAction('core.run', (format, ctx) => {
          emitter.emit('test', 1);
          emitter.emit('event', 'turing');
          ctx.reply({ pluginName: '', status: 'success' });
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
      await thymian.emitter.emitAction(
        'core.run',
        new ThymianFormat().export(),
      );
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
        emitter.onAction('core.run', (_, ctx) => {
          emitter.emitError({
            message: 'Error event!',
            name: 'MyError',
            options: {
              severity: 'error',
            },
          });

          ctx.reply({ pluginName: '', status: 'success' });
        });
      }),
    );

    try {
      await thymian.run(async () => {
        await thymian.emitter.emitAction(
          'core.run',
          new ThymianFormat().export(),
        );
      });
      expect.fail('Thymian should have rejected the promise.');
    } catch (err) {
      expect(closedSpy).toHaveBeenCalled();
      expect(err).toMatchObject({
        message: 'Error event!',
      });
    }
  });
});
