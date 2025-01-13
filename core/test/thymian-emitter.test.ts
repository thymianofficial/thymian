import { describe, expect, it, vitest } from 'vitest';
import { ThymianEmitter } from '../src/thymian-emitter.js';
import { MockLogger } from './mock.logger.js';
import { setTimeout } from 'node:timers/promises';
import { ThymianError } from '../src/thymian.error.js';

describe('ThymianEmitter', () => {
  it('.emitError() should emit error event', () =>
    new Promise<void>((done) => {
      const emitter = new ThymianEmitter(new MockLogger());
      emitter.on('thymian.error', (err: ThymianError) => {
        expect(err).toStrictEqual(new ThymianError('my error'));
        done();
      });

      emitter.emitError(new ThymianError('my error'));
    }));

  it('.emitExit() should emit exit event', () =>
    new Promise<void>((done) => {
      const emitter = new ThymianEmitter(new MockLogger());
      emitter.on('thymian.exit', (code: number, reason) => {
        expect(code).toBe(127);
        expect(reason).toBe('reason');
        done();
      });

      emitter.emitExit(127, 'reason');
    }));

  it('should idle after given timout', async () => {
    const emitter = new ThymianEmitter(new MockLogger(), {
      timeout: 2000,
    });

    emitter.onAsync('a', async () => {
      await setTimeout(1000);
      emitter.emit('b');
    });

    const start = performance.now();
    emitter.emit('a');

    await emitter.onIdle();
    const end = performance.now();

    expect(end - start).toBeGreaterThanOrEqual(3000);
  });

  it('should emit to multiple listeners', async () => {
    const emitter = new ThymianEmitter(new MockLogger(), { timeout: 1000 });
    const listener = vitest.fn();

    emitter.on('a', listener);
    emitter.on('a', listener);
    emitter.on('b', listener);

    emitter.emit('a');

    await emitter.onIdle();

    expect(listener.mock.calls).toHaveLength(2);
  });

  it('should call wildcards listeners', async () => {
    const emitter = new ThymianEmitter(new MockLogger());

    const listener = vitest.fn();

    emitter.on('a.**', listener);
    emitter.on('a.*', listener);
    emitter.on('a', listener);
    emitter.on('b.a', listener);
    emitter.on('**', listener);

    emitter.emit('a');

    await emitter.onIdle();

    expect(listener.mock.calls).toHaveLength(3);
  });

  it('.emitAsync() should return all results - with sync listener', async () => {
    const emitter = new ThymianEmitter(new MockLogger());

    emitter.onAsync('event', () => 1);
    emitter.onAsync('event', () => 2);

    const nums = await emitter.emitAsync<number>('event');

    expect(nums).toStrictEqual([1, 2]);
  });

  it('.emitAsync() should return all results - with async listener', async () => {
    const emitter = new ThymianEmitter(new MockLogger());

    emitter.onAsync('event', async () => 1);
    emitter.onAsync('event', async () => 2);

    const nums = await emitter.emitAsync<number>('event');

    expect(nums).toStrictEqual([1, 2]);
  });
});
