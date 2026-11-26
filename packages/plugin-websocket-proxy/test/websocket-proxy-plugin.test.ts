import { connect as connectRaw } from 'node:net';
import { networkInterfaces } from 'node:os';

import { Thymian, ThymianEmitter } from '@thymian/core';
import getPort from 'get-port';
import { afterEach, beforeEach, describe, expect, it, vitest } from 'vitest';
import { WebSocket } from 'ws';

import { websocketProxyPlugin } from '../src';
import { RegisterAckMessage } from '../src/messages';
import {
  nextMessage,
  openWithRetry,
  waitForClose,
  waitForOpen,
  waitForRejectedUpgrade,
} from './helpers';
import { ReferenceClient } from './reference-client';

declare module '@thymian/core' {
  interface ThymianActions {
    add: {
      event: { a: number; b: number };
      response: number;
    };
  }
}

describe('Websocket Proxy Plugin', () => {
  let port = 45681;

  beforeEach(async () => {
    port = await getPort();
  });

  it('closes connection for invalid JSON with code 1003', async () => {
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, { port });
    await thymian.ready();

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((r) => ws.on('open', r));

    ws.send('{"type":"register",');

    const closed = await waitForClose(ws);
    await thymian.close();

    expect(closed.code).toBe(1003);
  });

  it('closes connection for semantically incorrect message with code 1008', async () => {
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, { port });
    await thymian.ready();

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((r) => ws.on('open', r));

    ws.send(JSON.stringify({ type: 'register' }));

    const closed = await waitForClose(ws);
    await thymian.close();

    expect(closed.code).toBe(1008);
  });

  it('closes connection for unknown message type with code 1008', async () => {
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, { port });
    await thymian.ready();

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((r) => ws.on('open', r));

    ws.send(JSON.stringify({ type: 'unknown type' }));

    const closed = await waitForClose(ws);
    await thymian.close();

    expect(closed.code).toBe(1008);
  });

  it('closes connection with code 1008 if ready message is sent before registration', async () => {
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, { port });
    await thymian.ready();

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((r) => ws.on('open', r));

    ws.send(JSON.stringify({ type: 'ready' }));

    const closed = await waitForClose(ws);
    await thymian.close();

    expect(closed.code).toBe(1008);
  });

  it('closes connection if emit message is sent before the plugin is registered', async () => {
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, { port });
    await thymian.ready();

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((r) => ws.on('open', r));

    // emit vor register/ready
    ws.send(JSON.stringify({ type: 'emit', name: 'core.report', payload: {} }));

    const closed = await waitForClose(ws);
    await thymian.close();

    expect(closed.code).toBe(1008);
  });

  it('throws timeout error if plugin is required does not establish connection in time', async () => {
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port,
      clientTimeout: 100,
      plugins: [
        {
          name: 'test',
          token: 's3cr3t',
          required: true,
          options: {},
        },
      ],
    });

    const readyRejects = expect(thymian.ready()).rejects.toThrow(
      'Cannot establish a connection to a WebSocket client within 100ms.',
    );

    const ws = await openWithRetry(`ws://127.0.0.1:${port}`, {
      headers: { Authorization: 'Bearer s3cr3t' },
    });

    ws.send(JSON.stringify({ type: 'register', name: 'test' }));

    await nextMessage(ws);

    // this should trigger the timeout
    // ws.send(JSON.stringify({ type: 'ready' }));

    await readyRejects;

    // Clean up to prevent unhandled rejection
    ws.close();
    await thymian.close();
  });

  it('remote plugin can call action', async () => {
    const thymian = new Thymian();

    thymian
      .register(websocketProxyPlugin, {
        port,
        plugins: [
          {
            name: 'remote-plugin',
            token: 's3cr3t',
            required: true,
            options: {},
          },
        ],
      })
      .register(
        {
          name: 'math',
          version: '0.x',
          async plugin(emitter: ThymianEmitter): Promise<void> {
            emitter.onAction(
              'add',
              async (payload: { a: number; b: number }, ctx) => {
                ctx.reply(payload.a + payload.b);
              },
            );
          },
        },
        {},
      );

    const client = new ReferenceClient(port, 'remote-plugin', [], [], 's3cr3t');

    await Promise.all([thymian.ready(), client.init()]);

    const result = await client.emitAction<number>(
      'add',
      { a: 2, b: 3 },
      { strategy: 'deep-merge' },
    );

    await thymian.close();

    expect(result).toBe(5);
  });

  it('remote plugins only receive registered events', async () => {
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port,
      plugins: [
        { name: 'client-a', token: 'token-a', required: true, options: {} },
        { name: 'client-b', token: 'token-b', required: true, options: {} },
      ],
    });

    const a = new ReferenceClient(
      port,
      'client-a',
      [],
      ['core.report'],
      'token-a',
    );
    const b = new ReferenceClient(port, 'client-b', [], [], 'token-b');

    const aHandler = vitest.fn();
    const bHandler = vitest.fn();

    a.onEvent('core.report', aHandler);
    b.onEvent('core.report', bHandler);

    await Promise.all([thymian.ready(), a.init(), b.init()]);

    thymian.emitter.emit('core.report', { topic: 'x' });

    await thymian.close();

    expect(aHandler).toBeCalledTimes(1);
    expect(aHandler).toBeCalledWith({ topic: 'x' });
    expect(bHandler).not.toBeCalled();
  });

  it('rejects an invalid token in the register message and closes the connection', async () => {
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port,
      plugins: [{ name: 'test', token: 's3cr3t', options: {} }],
    });

    await thymian.ready();

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForOpen(ws);
    const closed = waitForClose(ws);

    ws.send(
      JSON.stringify({ type: 'register', name: 'test', token: 'secr3t' }),
    );

    const message = (await nextMessage(ws)) as RegisterAckMessage;
    expect(message).toMatchObject({
      type: 'register-ack',
      ok: false,
      reason: 'Unknown plugin or invalid token.',
    });
    expect((await closed).code).toBe(1008);

    await thymian.close();
  });

  it('accepts a valid token in the register message', async () => {
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port,
      plugins: [{ name: 'test', token: 's3cr3t', options: { key: 'value' } }],
    });

    await thymian.ready();

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForOpen(ws);

    ws.send(
      JSON.stringify({ type: 'register', name: 'test', token: 's3cr3t' }),
    );

    expect(await nextMessage(ws)).toMatchObject({
      type: 'register-ack',
      ok: true,
      config: { key: 'value' },
    });

    ws.close();
    await thymian.close();
  });
});

describe('Websocket Proxy Plugin security', () => {
  let port = 45681;
  let thymian: Thymian;

  const reportFn = vitest.fn();

  beforeEach(async () => {
    port = await getPort();
    reportFn.mockReset();

    thymian = new Thymian();
    thymian
      .register(websocketProxyPlugin, {
        port,
        allowedOrigins: ['https://trusted.example'],
        plugins: [
          { name: 'protected', token: 's3cr3t', options: { key: 'value' } },
          { name: 'other', token: '0ther', options: {} },
          { name: 'third', token: 'th1rd', options: {} },
        ],
      })
      .register(
        {
          name: 'custom-reporter',
          version: '0.x',
          async plugin(emitter: ThymianEmitter): Promise<void> {
            emitter.on('core.report', reportFn);
          },
        },
        {},
      );

    await thymian.ready();
  });

  afterEach(async () => {
    await thymian.close();
  });

  const connect = (headers: Record<string, string> = {}) =>
    new WebSocket(`ws://127.0.0.1:${port}`, { headers });

  async function expectRegistrationRejected(
    ws: WebSocket,
    register: Record<string, unknown>,
    reason: string,
  ): Promise<void> {
    await waitForOpen(ws);
    const closed = waitForClose(ws);

    ws.send(JSON.stringify({ type: 'register', ...register }));

    expect(await nextMessage(ws)).toMatchObject({
      type: 'register-ack',
      ok: false,
      reason,
    });
    expect((await closed).code).toBe(1008);
  }

  it('refuses the upgrade with 403 for a browser origin that is not allowed', async () => {
    const status = await waitForRejectedUpgrade(
      connect({ Origin: 'https://evil.example' }),
    );

    expect(status).toBe(403);
  });

  it('accepts the upgrade for an allowed browser origin', async () => {
    const ws = connect({ Origin: 'https://trusted.example' });

    await expect(waitForOpen(ws)).resolves.toBeUndefined();

    ws.close();
  });

  it('accepts a valid bearer token from a client library that sends an Origin header', async () => {
    const ws = connect({
      Authorization: 'Bearer s3cr3t',
      Origin: `http://127.0.0.1:${port}`,
    });
    await waitForOpen(ws);

    ws.send(JSON.stringify({ type: 'register', name: 'protected' }));

    expect(await nextMessage(ws)).toMatchObject({
      type: 'register-ack',
      ok: true,
    });

    ws.close();
  });

  it('refuses the upgrade with 401 for an unknown bearer token and an allowed origin', async () => {
    const status = await waitForRejectedUpgrade(
      connect({
        Authorization: 'Bearer wrong',
        Origin: 'https://trusted.example',
      }),
    );

    expect(status).toBe(401);
  });

  it('closes the connection with code 1009 for an oversized message before registration', async () => {
    const ws = connect();
    await waitForOpen(ws);

    ws.send(
      JSON.stringify({
        type: 'register',
        name: 'protected',
        token: 'x'.repeat(100_000),
      }),
    );

    expect((await waitForClose(ws)).code).toBe(1009);
  });

  it('fails an open action right away if the plugin handling it disconnects', async () => {
    const handlerClient = new ReferenceClient(
      port,
      'protected',
      ['add'],
      [],
      's3cr3t',
    );
    // never answers, disconnects as soon as the action arrives
    handlerClient['messageHandlers'].set('action', () => handlerClient.close());
    await handlerClient.init();

    // Retried until the server has processed the client's "ready". The action
    // timeout (5s) is far above the waitFor timeout (1s), so this only passes
    // if the disconnect itself fails the action.
    await vitest.waitFor(() =>
      expect(
        thymian.emitter.emitAction(
          'add',
          { a: 1, b: 2 },
          { strategy: 'first', timeout: 5000 },
        ),
      ).rejects.toThrow(
        'Remote plugin "protected" disconnected before replying to action "add".',
      ),
    );
  });

  it('refuses the upgrade with 401 for an unknown bearer token', async () => {
    const status = await waitForRejectedUpgrade(
      connect({ Authorization: 'Bearer wrong' }),
    );

    expect(status).toBe(401);
  });

  it('refuses the upgrade with 401 for a non-bearer authorization header', async () => {
    const status = await waitForRejectedUpgrade(
      connect({ Authorization: 'Basic czNjcjN0' }),
    );

    expect(status).toBe(401);
  });

  it('registers a plugin that authenticates with a bearer token', async () => {
    const ws = connect({ Authorization: 'Bearer s3cr3t' });
    await waitForOpen(ws);

    ws.send(JSON.stringify({ type: 'register', name: 'protected' }));

    expect(await nextMessage(ws)).toMatchObject({
      type: 'register-ack',
      ok: true,
      config: { key: 'value' },
    });

    ws.close();
  });

  it('does not let an authenticated plugin register under another name', async () => {
    await expectRegistrationRejected(
      connect({ Authorization: 'Bearer 0ther' }),
      { name: 'protected' },
      'Plugin name does not match the provided credentials.',
    );
  });

  it('does not give bus access to a client that failed the token check', async () => {
    const ws = connect();
    await waitForOpen(ws);
    const closed = waitForClose(ws);

    // the whole attack sequence at once, without waiting for the ack
    ws.send(JSON.stringify({ type: 'register', name: 'protected' }));
    ws.send(JSON.stringify({ type: 'ready' }));
    ws.send(
      JSON.stringify({
        type: 'emit',
        name: 'core.report',
        payload: { topic: 'injected' },
      }),
    );

    expect((await closed).code).toBe(1008);
    expect(reportFn).not.toBeCalled();
  });

  it('rejects a plugin name that is not configured', async () => {
    await expectRegistrationRejected(
      connect(),
      { name: 'unknown' },
      'Unknown plugin or invalid token.',
    );
  });

  it('rejects a duplicate plugin name and keeps the original client working', async () => {
    const original = new ReferenceClient(
      port,
      'third',
      [],
      ['core.report'],
      'th1rd',
    );
    const originalHandler = vitest.fn();
    original.onEvent('core.report', originalHandler);
    await original.init();

    await expectRegistrationRejected(
      connect({ Authorization: 'Bearer th1rd' }),
      { name: 'third', onEvents: ['core.report'] },
      'Name already in use.',
    );

    await original.emitEvent('core.report', { topic: 'still-alive' });
    await vitest.waitFor(() => expect(originalHandler).toBeCalledTimes(1));

    original.close();
  });

  it('rejects a duplicate name while the first registration is still in flight', async () => {
    const first = connect({ Authorization: 'Bearer th1rd' });
    await waitForOpen(first);
    first.send(JSON.stringify({ type: 'register', name: 'third' }));
    await nextMessage(first);
    // "first" has not sent "ready" yet

    await expectRegistrationRejected(
      connect({ Authorization: 'Bearer th1rd' }),
      { name: 'third' },
      'Name already in use.',
    );

    first.close();
  });

  it('releases a plugin name when its connection closes', async () => {
    const first = new ReferenceClient(port, 'third', [], [], 'th1rd');
    await first.init();
    first.close();

    const handler = vitest.fn();

    await vitest.waitFor(async () => {
      const second = new ReferenceClient(
        port,
        'third',
        [],
        ['core.report'],
        'th1rd',
      );
      second.onEvent('core.report', handler);
      await second.init();
      expect(second.options).toEqual({});
    });

    // events reach the new connection (re-emitted until "ready" is processed)
    await vitest.waitFor(() => {
      thymian.emitter.emit('core.report', { topic: 'x' });
      expect(handler).toBeCalled();
    });
  });

  it('ignores an action reply from a client the action was not sent to', async () => {
    const handlerClient = new ReferenceClient(
      port,
      'protected',
      ['add'],
      [],
      's3cr3t',
    );
    let forwardedId = '';
    // never answers, only records the id of the forwarded action
    handlerClient['messageHandlers'].set('action', (message: unknown) => {
      forwardedId = (message as { id: string }).id;
    });
    await handlerClient.init();

    const intruder = connect({ Authorization: 'Bearer th1rd' });
    await waitForOpen(intruder);
    intruder.send(JSON.stringify({ type: 'register', name: 'third' }));
    await nextMessage(intruder);
    intruder.send(JSON.stringify({ type: 'ready' }));

    const result = thymian.emitter.emitAction(
      'add',
      { a: 1, b: 2 },
      { strategy: 'first', timeout: 300, strict: false },
    );

    await vitest.waitFor(() => expect(forwardedId).not.toBe(''));

    intruder.send(
      JSON.stringify({
        type: 'actionReply',
        correlationId: forwardedId,
        name: 'add',
        payload: 666,
      }),
    );

    await expect(result).resolves.toBeUndefined();

    intruder.close();
    handlerClient.close();
  });
});

/** An IPv4 address of this machine that is not a loopback address, if any. */
const externalAddress = Object.values(networkInterfaces())
  .flat()
  .find((address) => address?.family === 'IPv4' && !address.internal)?.address;

describe('Websocket Proxy Plugin configuration', () => {
  it('accepts unconfigured plugins only if allowUnauthenticatedPlugins is set', async () => {
    const port = await getPort();
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port,
      allowUnauthenticatedPlugins: true,
    });
    await thymian.ready();

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForOpen(ws);
    ws.send(JSON.stringify({ type: 'register', name: 'anything' }));

    expect(await nextMessage(ws)).toMatchObject({
      type: 'register-ack',
      ok: true,
      config: {},
    });

    ws.close();
    await thymian.close();
  });

  it('does not fail the startup for an anonymous connection that never registers', async () => {
    const port = await getPort();
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port,
      clientTimeout: 50,
      plugins: [
        { name: 'needed', token: 's3cr3t', required: true, options: {} },
      ],
    });

    const ready = thymian.ready();

    const idle = await openWithRetry(`ws://127.0.0.1:${port}`);
    expect((await waitForClose(idle)).code).toBe(1008);

    const client = new ReferenceClient(port, 'needed', [], [], 's3cr3t');
    await client.init();

    await expect(ready).resolves.toBeUndefined();

    await thymian.close();
  });

  it('closes the connection for an empty plugin name', async () => {
    const port = await getPort();
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port,
      allowUnauthenticatedPlugins: true,
    });
    await thymian.ready();

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForOpen(ws);
    ws.send(JSON.stringify({ type: 'register', name: '' }));

    expect((await waitForClose(ws)).code).toBe(1008);

    await thymian.close();
  });

  it('fails the startup if an authenticated required plugin never registers', async () => {
    const port = await getPort();
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port,
      clientTimeout: 50,
      plugins: [
        { name: 'needed', token: 's3cr3t', required: true, options: {} },
      ],
    });

    const readyRejects = expect(thymian.ready()).rejects.toThrow(
      'Cannot establish a connection to a WebSocket client within 50ms.',
    );

    const ws = await openWithRetry(`ws://127.0.0.1:${port}`, {
      headers: { Authorization: 'Bearer s3cr3t' },
    });
    const closed = waitForClose(ws);

    await readyRejects;
    expect((await closed).code).toBe(1008);

    await thymian.close();
  });

  it('keeps the safe defaults for options that are set to null', async () => {
    const port = await getPort();
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port,
      host: null,
      allowedOrigins: null,
      maxPayload: null,
      allowUnauthenticatedPlugins: null,
    } as never);
    await thymian.ready();

    // the origin check is still in place and does not throw
    const status = await waitForRejectedUpgrade(
      new WebSocket(`ws://127.0.0.1:${port}`, {
        headers: { Origin: 'https://evil.example' },
      }),
    );
    expect(status).toBe(403);

    // unconfigured plugins are still rejected
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForOpen(ws);
    ws.send(JSON.stringify({ type: 'register', name: 'anything' }));
    expect(await nextMessage(ws)).toMatchObject({ ok: false });

    await thymian.close();
  });

  it('refuses to start if a plugin has no token', async () => {
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port: await getPort(),
      plugins: [
        { name: 'a', token: 's3cr3t', options: {} },
        { name: 'b', options: {} },
      ],
    });

    await expect(thymian.ready()).rejects.toThrow(
      'No token is configured for the remote plugin "b".',
    );
  });

  it('accepts a plugin without token if allowUnauthenticatedPlugins is set', async () => {
    const port = await getPort();
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port,
      allowUnauthenticatedPlugins: true,
      plugins: [{ name: 'local', options: { key: 'value' } }],
    });
    await thymian.ready();

    const client = new ReferenceClient(port, 'local', [], []);
    await client.init();

    expect(client.options).toEqual({ key: 'value' });

    client.close();
    await thymian.close();
  });

  it('refuses to start on a non-loopback host with allowUnauthenticatedPlugins', async () => {
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port: await getPort(),
      host: '0.0.0.0',
      allowUnauthenticatedPlugins: true,
    });

    await expect(thymian.ready()).rejects.toThrow(
      '"allowUnauthenticatedPlugins" is enabled',
    );
  });

  it('resolves ready if another plugin connects before the required one', async () => {
    const port = await getPort();
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port,
      plugins: [
        { name: 'optional', token: '0ptional', options: {} },
        { name: 'needed', token: 's3cr3t', required: true, options: {} },
      ],
    });

    const ready = thymian.ready();

    const optional = new ReferenceClient(port, 'optional', [], [], '0ptional');
    await optional.init();
    const needed = new ReferenceClient(port, 'needed', [], [], 's3cr3t');
    await needed.init();

    await expect(ready).resolves.toBeUndefined();

    await thymian.close();
  });

  it('closes the connection with code 1009 for a message above maxPayload', async () => {
    const port = await getPort();
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port,
      maxPayload: 1024,
      allowUnauthenticatedPlugins: true,
    });
    await thymian.ready();

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForOpen(ws);
    ws.send(
      JSON.stringify({
        type: 'register',
        name: 'big',
        token: 'x'.repeat(2048),
      }),
    );

    expect((await waitForClose(ws)).code).toBe(1009);

    await thymian.close();
  });

  // the LAN case of the advisory: by default the server must not be
  // reachable through an address of another network interface
  it.skipIf(!externalAddress)(
    'is not reachable through a non-loopback address by default',
    async () => {
      const port = await getPort();
      const thymian = new Thymian();

      thymian.register(websocketProxyPlugin, {
        port,
        plugins: [{ name: 'a', token: 's3cr3t', options: {} }],
      });
      await thymian.ready();

      // sanity check: the server is up and reachable on loopback
      const local = new WebSocket(`ws://127.0.0.1:${port}`);
      await waitForOpen(local);
      local.close();

      await expect(
        waitForOpen(new WebSocket(`ws://${externalAddress}:${port}`)),
      ).rejects.toMatchObject({ code: 'ECONNREFUSED' });

      await thymian.close();
    },
  );

  it('requires the bearer header for every connection on a non-loopback host', async () => {
    const port = await getPort();
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port,
      host: '0.0.0.0',
      allowedOrigins: ['https://trusted.example'],
      plugins: [{ name: 'a', token: 's3cr3t', options: {} }],
    });
    await thymian.ready();

    const url = `ws://127.0.0.1:${port}`;

    // no credentials: no WebSocket, not even to try a token in "register"
    expect(await waitForRejectedUpgrade(new WebSocket(url))).toBe(401);

    const authenticated = new WebSocket(url, {
      headers: { Authorization: 'Bearer s3cr3t' },
    });
    await expect(waitForOpen(authenticated)).resolves.toBeUndefined();
    authenticated.close();

    // a browser client from an allowed origin sends its token in "register"
    const browser = new WebSocket(url, {
      headers: { Origin: 'https://trusted.example' },
    });
    await waitForOpen(browser);
    browser.send(
      JSON.stringify({ type: 'register', name: 'a', token: 's3cr3t' }),
    );
    expect(await nextMessage(browser)).toMatchObject({ ok: true });
    browser.close();

    await thymian.close();
  });

  it('limits unauthenticated connections in the handshake without locking out authenticated plugins', async () => {
    const port = await getPort();
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port,
      plugins: [{ name: 'a', token: 's3cr3t', options: {} }],
    });
    await thymian.ready();

    const url = `ws://127.0.0.1:${port}`;
    const idle = Array.from({ length: 64 }, () => new WebSocket(url));
    await Promise.all(idle.map((ws) => waitForOpen(ws)));

    expect(await waitForRejectedUpgrade(new WebSocket(url))).toBe(503);

    const client = new ReferenceClient(port, 'a', [], [], 's3cr3t');
    await client.init();
    expect(client.options).toEqual({});

    client.close();
    idle.forEach((ws) => ws.close());
    await thymian.close();
  });

  it('starts on a non-loopback host if every plugin has a token', async () => {
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port: await getPort(),
      host: '0.0.0.0',
      plugins: [{ name: 'a', token: 's3cr3t', options: {} }],
    });

    await expect(thymian.ready()).resolves.toBeUndefined();

    await thymian.close();
  });

  it('rejects an empty token in the plugin options', async () => {
    const thymian = new Thymian();
    const port = await getPort();

    // already rejected by the options schema
    expect(() =>
      thymian.register(websocketProxyPlugin, {
        port,
        plugins: [{ name: 'a', token: '', options: {} }],
      }),
    ).toThrow('/plugins/0/token must be 1 character or more');
  });

  it('treats a null token as no token', async () => {
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port: await getPort(),
      plugins: [{ name: 'a', token: null, options: {} }],
    } as never);

    await expect(thymian.ready()).rejects.toThrow(
      'No token is configured for the remote plugin "a".',
    );
  });

  it('refuses to start if two plugins share a name', async () => {
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port: await getPort(),
      plugins: [
        { name: 'a', token: 'first', options: {} },
        { name: 'a', token: 'second', options: {} },
      ],
    });

    await expect(thymian.ready()).rejects.toThrow(
      'Two or more remote plugins are configured with the same name.',
    );
  });

  it('does not let a peer with a rejected upgrade delay the shutdown', async () => {
    const port = await getPort();
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port,
      plugins: [{ name: 'a', token: 's3cr3t', options: {} }],
    });
    await thymian.ready();

    // a raw client that never closes its side after the 401
    const socket = connectRaw({ port, host: '127.0.0.1', allowHalfOpen: true });
    await new Promise((resolve) => socket.once('connect', resolve));
    const serverClosed = new Promise((resolve) => socket.once('end', resolve));
    socket.resume();
    socket.write(
      'GET / HTTP/1.1\r\nHost: x\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n' +
        'Sec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
        'Authorization: Bearer wrong\r\n\r\n',
    );
    await serverClosed;

    const start = Date.now();
    await thymian.close();
    expect(Date.now() - start).toBeLessThan(3000);

    socket.destroy();
  });

  it('refuses to start if two plugins share a token', async () => {
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port: await getPort(),
      plugins: [
        { name: 'a', token: 'same', options: {} },
        { name: 'b', token: 'same', options: {} },
      ],
    });

    await expect(thymian.ready()).rejects.toThrow(
      'Two or more remote plugins are configured with the same token.',
    );
  });
});
