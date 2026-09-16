import { createServer } from 'node:net';

import { NoopLogger, Thymian, type ThymianErrorEvent } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import dispatcherPlugin from '../src/index.js';

describe('runner plugin', () => {
  it('should emit', async () => {
    const thymian = new Thymian(new NoopLogger());

    thymian.register(dispatcherPlugin, { arg: 4 });

    await thymian.ready();
  });
});

/** A port nothing is listening on, gotten by binding then immediately closing. */
async function getClosedPort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(port);
      });
    });

    server.on('error', reject);
  });
}

/**
 * #131: a request-scoped transport error is a fault of the one request that
 * made it, never of the run — so it must not carry `Thymian.run`'s default
 * `severity: 'error'`, which would close the whole run through the error
 * subscription (ADR-0023 records the same rule for the hook path).
 */
describe('a request that cannot be dispatched', () => {
  it('raises ServerUnavailableError at warn severity and throws, for a refused connection', async () => {
    const thymian = new Thymian(new NoopLogger());

    thymian.register(dispatcherPlugin, {});

    const port = await getClosedPort();
    const errors: ThymianErrorEvent<'ServerUnavailableError'>[] = [];

    await thymian.ready();

    const subscription = thymian.emitter.onError((event) => {
      if (event.error.name === 'ServerUnavailableError') {
        errors.push(event as ThymianErrorEvent<'ServerUnavailableError'>);
      }
    });

    try {
      await expect(
        thymian.emitter.emitAction('core.request.dispatch', {
          request: {
            origin: `http://127.0.0.1:${port}`,
            path: '/',
            method: 'GET',
          },
        }),
      ).rejects.toMatchObject({ name: 'ServerUnavailableError' });

      expect(errors).toHaveLength(1);
      expect(errors[0]?.error.options.severity).toBe('warn');
    } finally {
      subscription.unsubscribe();
      await thymian.close();
    }
  });

  it('raises RequestDispatchError at warn severity and throws, for any other dispatch failure', async () => {
    const thymian = new Thymian(new NoopLogger());

    thymian.register(dispatcherPlugin, {});

    const errors: ThymianErrorEvent<'RequestDispatchError'>[] = [];

    await thymian.ready();

    const subscription = thymian.emitter.onError((event) => {
      if (event.error.name === 'RequestDispatchError') {
        errors.push(event as ThymianErrorEvent<'RequestDispatchError'>);
      }
    });

    try {
      await expect(
        thymian.emitter.emitAction('core.request.dispatch', {
          request: {
            origin: 'http://127.0.0.1',
            path: '/',
            // Not a valid HTTP method — dispatchHttpRequest throws a plain
            // Error before any network activity, exercising the fallback
            // branch without depending on network timing.
            method: 'NOT-A-METHOD',
          },
        }),
      ).rejects.toMatchObject({ name: 'RequestDispatchError' });

      expect(errors).toHaveLength(1);
      expect(errors[0]?.error.options.severity).toBe('warn');
    } finally {
      subscription.unsubscribe();
      await thymian.close();
    }
  });

  it('never closes a Thymian.run over one refused connection', async () => {
    const thymian = new Thymian(new NoopLogger());

    thymian.register(dispatcherPlugin, {});

    const port = await getClosedPort();

    const result = await thymian.run(async (emitter) => {
      await expect(
        emitter.emitAction('core.request.dispatch', {
          request: {
            origin: `http://127.0.0.1:${port}`,
            path: '/',
            method: 'GET',
          },
        }),
      ).rejects.toMatchObject({ name: 'ServerUnavailableError' });

      // Reached only if the run did not close on the transport error above.
      return 'run finished';
    });

    expect(result).toBe('run finished');
  });
});
