import { setTimeout } from 'node:timers/promises';

import { describe, expect, it, vitest } from 'vitest';

import { NoopLogger } from '../src/logger/noop.logger.js';
import { ThymianError } from '../src/thymian.error.js';
import { ThymianEmitter } from '../src/thymian-emitter.js';

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

describe('ThymianEmitter', () => {
  it('.emitError() should emit error event', () =>
    new Promise<void>((done) => {
      const emitter = new ThymianEmitter(new NoopLogger());
      emitter.onEvent('core.error', (err: ThymianError) => {
        expect(err).toStrictEqual(new ThymianError('my error'));
        done();
      });

      emitter.emitError(new ThymianError('my error'));
    }));

  it('should idle after given timout', async () => {
    const emitter = new ThymianEmitter(new NoopLogger(), {
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
    const emitter = new ThymianEmitter(new NoopLogger(), { timeout: 1000 });
    const listener = vitest.fn();

    emitter.onEvent('a', listener);
    emitter.onEvent('a', listener);
    emitter.onEvent('b', listener);

    emitter.emitEvent('a');

    await emitter.onIdle();

    expect(listener.mock.calls).toHaveLength(2);
  });

  it('.runHook() should return all results - with sync listener', async () => {
    const emitter = new ThymianEmitter(new NoopLogger());

    emitter.onHook('hook', () => ({ result: 1 }));
    emitter.onHook('hook', () => ({ result: 2 }));

    const nums = await emitter.runHook('hook');

    expect(nums).toStrictEqual([1, 2]);
  });

  it('.runHook() should return all results - with async listener', async () => {
    const emitter = new ThymianEmitter(new NoopLogger());

    emitter.onHook('hook', async () => ({ result: 1 }));
    emitter.onHook('hook', async () => ({ result: 2 }));

    const nums = await emitter.runHook('hook');

    expect(nums).toStrictEqual([1, 2]);
  });

  it('.runHook() should deep merge result for deep merge strategy', async () => {
    const emitter = new ThymianEmitter(new NoopLogger());

    emitter.onHook('hook', async () => ({
      result: {
        a: {
          b: 2,
          c: 17,
        },
      },
    }));
    emitter.onHook('hook', async () => ({
      score: 10,
      result: {
        a: {
          b: 3,
        },
      },
    }));

    const result = await emitter.runHook('hook', undefined, {
      type: 'deep-merge',
    });

    expect(result).toMatchObject({
      a: {
        b: 3,
        c: 17,
      },
    });
  });

  it('.runHook() should return result with highest score for vote strategy', async () => {
    const emitter = new ThymianEmitter(new NoopLogger());

    emitter.onHook('hook', async () => ({
      score: 9.8,
      result: 'b',
    }));
    emitter.onHook('hook', async () => ({
      score: 10,
      result: 'a',
    }));

    const result = await emitter.runHook('hook', undefined, {
      type: 'vote',
    });

    expect(result).toBe('a');
  });
});
