import { setTimeout } from 'node:timers/promises';

import { beforeEach, describe, expect, it } from 'vitest';

import { PromiseQueue } from '../src/promise-queue.js';

describe('PromiseQueue', () => {
  let queue: PromiseQueue;

  beforeEach(() => {
    queue = new PromiseQueue();
  });

  describe('.add()', () => {
    it('should return a promise', async () => {
      const p = queue.add(async () => undefined);

      expect(p).toBeInstanceOf(Promise);
      await p;
    });

    it('should add items to queue in correct order', async () => {
      const vals: number[] = [];

      queue.add(async () => {
        await setTimeout(500);
        queue.add(async () => vals.push(3));
        vals.push(1);
      });

      await setTimeout(1000);

      await queue.add(async () => {
        vals.push(2);
      });

      expect(vals).toStrictEqual([1, 3, 2]);
    });
  });

  it('should process items in order', async () => {
    const vals: string[] = [];
    const logs: number[] = [];

    vals.push(
      await queue.add(async () => {
        logs.push(1);
        await setTimeout(1000);
        logs.push(2);
        return 'a';
      })
    );
    vals.push(
      await queue.add(async () => {
        logs.push(4);
        return 'b';
      })
    );

    expect(vals).toStrictEqual(['a', 'b']);
    expect(logs).toStrictEqual([1, 2, 4]);
  });

  it('.size() should return correct size', async () => {
    const p1 = queue.add(async () => {
      await setTimeout(500);
      return 1;
    });
    const p2 = queue.add(async () => {
      await setTimeout(500);
      return 2;
    });

    expect(queue.size()).toBe(2);

    await p1;
    expect(queue.size()).toBe(1);

    await p2;
  });

  it('should handle errors', async () => {
    const queue = new PromiseQueue();
    try {
      await queue.add(async () => {
        throw new Error('1');
      });
      expect(true).toBeFalsy();
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toEqual('1');
    }
    expect(
      await queue.add(async () => {
        return 100;
      })
    ).toEqual(100);
  });
});
