import { beforeEach, describe, expect, it, vitest } from 'vitest';
import { Thymian } from '../src/thymian.js';
import { MockLogger } from './mock.logger.js';
import { ThymianEmitter } from '../src/thymian-emitter.js';
import { ThymianError } from '../src/thymian.error.js';
import type { ThymianPlugin } from '../src/plugin.js';

const plugin: ThymianPlugin = {
  name: '',
  options: {},
  version: '',
  plugin: () => Promise.resolve(),
};

describe('Thymian', () => {
  let thymian: Thymian;

  beforeEach(() => {
    thymian = new Thymian(new MockLogger());
  });

  it('should emit register event', async () => {
    const a = vitest.fn();

    thymian.register({
      name: '',
      options: {},
      version: '',
      plugin: async (emitter) => {
        emitter.on('thymian.register', a);
      },
    });

    thymian.register(plugin).register(plugin).register(plugin);

    await thymian.start();

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
        emitter.on('thymian.start', () => {
          emitter.emit('sync-event');
          emitter.emit('test');
        });
      },
    });

    thymian.register({
      name: '',
      options: {},
      version: '',
      plugin: async (emitter) => {
        emitter.on('sync-event', a);
      },
    });

    thymian.register<{ event: string }>(
      {
        name: '',
        options: {},
        version: '',
        plugin: async (emitter, logger, opts) => {
          emitter.on(opts.event, b);
        },
      },
      {
        event: 'test',
      }
    );

    await thymian.start();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  describe('.start()', () => {
    it('should reject for an emitted error', async () => {
      thymian.register({
        name: '',
        options: {},
        async plugin(emitter: ThymianEmitter): Promise<void> {
          emitter.emitError(new ThymianError('my error'));
        },
        version: '',
      });

      await expect(async () => await thymian.start()).rejects.toThrow(
        new ThymianError('my error')
      );
    });
  });
});
