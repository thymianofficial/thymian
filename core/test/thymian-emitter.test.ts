import { describe, expect, it, vitest } from 'vitest';
import { ThymianEmitter } from '../src/thymian-emitter.js';
import { MockLogger } from './mock.logger.js';
import { setTimeout } from 'node:timers/promises';
import { ThymianError } from '../src/thymian.error.js';

describe('ThymianEmitter', () => {
  it('.emitError() should emit error event', () =>
    new Promise<void>((done) => {
      const emitter = new ThymianEmitter(new MockLogger());
      emitter.onEvent('thymian.error', (err: ThymianError) => {
        expect(err).toStrictEqual(new ThymianError('my error'));
        done();
      });

      emitter.emitError(new ThymianError('my error'));
    }));

  it('should idle after given timout', async () => {
    const emitter = new ThymianEmitter(new MockLogger(), {
      timeout: 2000,
    });

    emitter.onEvent('a', async () => {
      await setTimeout(1000);
      emitter.emitEvent('b');
    });

    const start = performance.now();
    emitter.emitEvent('a');

    await emitter.onIdle();
    const end = performance.now();

    expect(end - start).toBeGreaterThanOrEqual(3000);
  });

  it('should emit to multiple listeners', async () => {
    const emitter = new ThymianEmitter(new MockLogger(), { timeout: 1000 });
    const listener = vitest.fn();

    emitter.onEvent('a', listener);
    emitter.onEvent('a', listener);
    emitter.onEvent('b', listener);

    emitter.emitEvent('a');

    await emitter.onIdle();

    expect(listener.mock.calls).toHaveLength(2);
  });

  it('should call wildcards listeners', async () => {
    const emitter = new ThymianEmitter(new MockLogger());

    const listener = vitest.fn();

    emitter.onEvent('a.**', listener);
    emitter.onEvent('a.*', listener);
    emitter.onEvent('a', listener);
    emitter.onEvent('b.a', listener);
    emitter.onEvent('**', listener);

    emitter.emitEvent('a');

    await emitter.onIdle();

    expect(listener.mock.calls).toHaveLength(3);
  });

  it('.runHook() should return all results - with sync listener', async () => {
    const emitter = new ThymianEmitter(new MockLogger());

    emitter.onHook('hook', () => 1);
    emitter.onHook('hook', () => 2);

    const nums = await emitter.runHook<number>('hook');

    expect(nums).toStrictEqual([1, 2]);
  });

  it('.runHook() should return all results - with async listener', async () => {
    const emitter = new ThymianEmitter(new MockLogger());

    emitter.onHook('hook', async () => 1);
    emitter.onHook('hook', async () => 2);

    const nums = await emitter.runHook<number>('hook');

    expect(nums).toStrictEqual([1, 2]);
  });
});
