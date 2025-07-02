import { beforeEach, describe, expect, it, vitest } from 'vitest';

import {
  NoopLogger,
  PluginRegistrationError,
  Thymian,
  ThymianEmitter,
  ThymianError,
  type ThymianPlugin,
} from '../src/index.js';

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
      version: '',
      plugin: async (emitter) => {
        emitter.onEvent('run', () => {
          emitter.emitEvent('sync-event');
          emitter.emitEvent('test');
        });
      },
    });

    thymian.register({
      name: '',
      version: '',
      plugin: async (emitter) => {
        emitter.onEvent('sync-event', a);
      },
    });

    thymian.register<{ event: string }>(
      {
        name: '',
        version: '',
        plugin: async (emitter, logger, opts) => {
          emitter.onEvent(opts.event, b);
        },
      },
      {
        event: 'test',
      }
    );

    await thymian.ready();

    thymian.emitter.emitEvent('run');

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    await thymian.close();
  });

  // TODO: make test independent from package.json version
  it('register should throw for plugin version mismatch', () => {
    expect(() =>
      thymian.register({
        name: '@thymian/test-plugin',
        async plugin(emitter: ThymianEmitter): Promise<void> {
          emitter.emitError(new ThymianError('my error'));
        },
        version: '1.x',
      })
    ).toThrowError(PluginRegistrationError);
  });
});
