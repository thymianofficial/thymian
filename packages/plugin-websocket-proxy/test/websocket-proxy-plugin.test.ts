import { Thymian, ThymianEmitter } from '@thymian/core';
import getPort from 'get-port';
import { beforeEach, describe, expect, it, vitest } from 'vitest';
import { WebSocket } from 'ws';

import { websocketProxyPlugin } from '../src';
import { RegisterAckMessage } from '../src/messages';
import { nextMessage, waitForClose } from './helpers';
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
      clientTimeout: 10,
      plugins: [
        {
          name: 'test',
          required: true,
          options: {},
        },
      ],
    });

    const ready = thymian.ready();

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((r) => ws.on('open', r));

    ws.send(JSON.stringify({ type: 'register', name: 'test' }));

    await nextMessage(ws);

    // this should trigger the timeout
    // ws.send(JSON.stringify({ type: 'ready' }));

    await expect(() => ready).rejects.toThrowError(
      'Cannot establish a connection to a WebSocket client within 10ms.',
    );

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

    const client = new ReferenceClient(port, 'remote-plugin', [], []);

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
        { name: 'client-a', required: true, options: {} },
        { name: 'client-b', required: true, options: {} },
      ],
    });

    const a = new ReferenceClient(port, 'client-a', [], ['core.report']);
    const b = new ReferenceClient(port, 'client-b', [], []);

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

  it('should not acknowledge plugin registration with invalid token', async () => {
    const thymian = new Thymian();

    thymian.register(websocketProxyPlugin, {
      port,
      plugins: [{ name: 'test', token: 's3cr3t', options: {} }],
    });

    await thymian.ready();

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((r) => ws.on('open', r));

    ws.send(
      JSON.stringify({ type: 'register', name: 'test', token: 'secr3t' }),
    );

    const message = (await nextMessage(ws)) as RegisterAckMessage;
    expect(message).toMatchObject({
      type: 'register-ack',
      ok: false,
    });

    ws.close();

    await thymian.close();
  });
});
