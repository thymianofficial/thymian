import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { ThymianEmitter } from '../src/emitter/thymian-emitter.js';
import { NoopLogger } from '../src/logger/noop.logger.js';

declare module '../src/events/index.js' {
  interface ThymianEvents {
    a: number;
    b: string;
  }
}

declare module '../src/actions/index.js' {
  interface ThymianActions {
    testAction: {
      event: string;
      response: number;
    };
    action: {
      event: string;
      response: number;
    };
    forDeepMerge: {
      event: number;
      response: {
        a?: number;
        b?: number;
      };
    };
  }
}

describe('ThymianEmitter', () => {
  let emitter: ThymianEmitter;

  beforeEach(() => {
    emitter = new ThymianEmitter(new NoopLogger(), {
      completed: new Set(),
      errors: new Subject(),
      events: new Subject(),
      listeners: new Map(),
      responses: new Subject(),
      source: '@thymian/core',
    });
  });

  it('should emit to multiple listeners', async () => {
    const listener = vitest.fn();

    emitter.on('a', listener);
    emitter.on('a', listener);
    emitter.on('b', listener);

    emitter.emit('a', 2);

    expect(listener.mock.calls).toHaveLength(2);
  });

  it('.emitAction() should return all results - with sync listener', async () => {
    emitter.onAction('action', (str, ctx) => {
      ctx.reply(+str);
    });
    emitter.onAction('action', (str, ctx) => {
      ctx.reply(+str + +str); // lol
    });

    const nums = await emitter.emitAction('action', '5');

    expect(nums).toStrictEqual([5, 10]);
  });

  it('.emitAction() should return all results - with async listener', async () => {
    emitter.onAction('action', async (str, ctx) => {
      ctx.reply(+str);
    });
    emitter.onAction('action', async (str, ctx) => {
      ctx.reply(+str + +str); // lol
    });

    const nums = await emitter.emitAction('action', '5');

    expect(nums).toStrictEqual([5, 10]);
  });

  it('.emitAction() should deep merge result for deep merge strategy', async () => {
    emitter.onAction('forDeepMerge', async (num, ctx) => {
      ctx.reply({
        a: num,
        b: 2,
      });
    });

    emitter.onAction('forDeepMerge', async (num, ctx) => {
      ctx.reply({
        b: 42,
      });
    });

    const result = await emitter.emitAction('forDeepMerge', 11, {
      strategy: 'deep-merge',
    });

    expect(result).toMatchObject({
      a: 11,
      b: 42,
    });
  });

  it('should throw error if action is emitted for which no handler is registered and strict mode enabled', async () => {
    await expect(() =>
      emitter.emitAction('testAction', '2', {
        strategy: 'deep-merge',
      }),
    ).rejects.toThrowError('No listener for action "testAction" registered.');
  });

  it('should return undefined if action is emitted for which no handler is registered and strict mode disabled', async () => {
    const result = await emitter.emitAction('testAction', '2', {
      strategy: 'deep-merge',
      strict: false,
    });

    expect(result).toBeUndefined();
  });
});
