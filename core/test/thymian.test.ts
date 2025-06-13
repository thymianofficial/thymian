import { beforeEach, describe, expect, it, vitest } from 'vitest';
import { PluginRegistrationError, Thymian } from '../src/thymian.js';
import { ThymianEmitter } from '../src/thymian-emitter.js';
import { ThymianError } from '../src/thymian.error.js';
import type { ThymianPlugin } from '../src/plugin.js';
import { NoopLogger } from '../src/logger/noop.logger.js';

declare module '../src/thymian-emitter.js' {
  interface ThymianHooks {
    [event: string]: {
      args: unknown[];
      returnType: unknown;
    };
  }

  interface ThymianEvents {
    [event: string]: unknown[];
  }
}

const plugin: ThymianPlugin = {
  name: '',
  options: {},
  version: '',
  plugin: () => Promise.resolve(),
};

describe('Thymian', () => {
  let thymian: Thymian;

  beforeEach(() => {
    thymian = new Thymian(new NoopLogger());
  });

  it('should emit register event', async () => {
    const a = vitest.fn();

    thymian.register({
      name: '',
      options: {},
      version: '',
      plugin: async (emitter) => {
        emitter.onEvent('core.register', a);
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
      options: {},
      version: '',
      plugin: async (emitter) => {
        emitter.onEvent('core.run', () => {
          emitter.emitEvent('sync-event');
          emitter.emitEvent('test');
        });
      },
    });

    thymian.register({
      name: '',
      options: {},
      version: '',
      plugin: async (emitter) => {
        emitter.onEvent('sync-event', a);
      },
    });

    thymian.register<{ event: string }>(
      {
        name: '',
        options: {},
        version: '',
        plugin: async (emitter, logger, opts) => {
          emitter.onEvent(opts.event, b);
        },
      },
      {
        event: 'test',
      }
    );

    await thymian.run();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  describe('.start()', () => {
    it.skip('should reject for an emitted error', async () => {
      thymian.register({
        name: '',
        options: {},
        async plugin(emitter: ThymianEmitter): Promise<void> {
          emitter.emitError(new ThymianError('my error'));
        },
        version: '',
      });

      await expect(async () => await thymian.run()).rejects.toThrow(
        new ThymianError('my error')
      );
    });
  });

  // TODO: make test independent from package.json version
  it('register should throw for plugin version mismatch', () => {
    expect(() =>
      thymian.register({
        name: '@thymian/test-plugin',
        options: {},
        async plugin(emitter: ThymianEmitter): Promise<void> {
          emitter.emitError(new ThymianError('my error'));
        },
        version: '1.x',
      })
    ).toThrowError(PluginRegistrationError);
  });
});
