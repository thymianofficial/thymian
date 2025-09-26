import * as net from 'node:net';

import {
  Logger,
  TextLogger,
  ThymianEmitter,
  ThymianEvent,
  ThymianFormat,
  ThymianReport,
  ThymianResponseEvent,
} from '@thymian/core';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TcpProxyServer, TcpServerOptions } from '../src/tcp-proxy-server.js';

describe('TcpProxyServer', () => {
  it('should work', { timeout: 100000 }, async () => {
    const reportFn = vi.fn();
    const logger = new TextLogger('TCP', true);

    const emitter = new ThymianEmitter(
      logger,
      {
        completed: new Set(),
        errors: new Subject(),
        events: new Subject(),
        listeners: new Map(),
        responses: new Subject(),
        source: '@thymian/core',
      },
      {
        timeout: 5000,
      }
    );

    emitter.on('core.report', reportFn);

    const server = new TcpProxyServer(logger, emitter, {
      port: 5000,
      requiredClientNames: ['client1'],
      timeout: 5000,
    });

    const runPromise = server.run();

    const client = net.createConnection(5000, '127.0.0.1', () => {
      client.write(
        JSON.stringify({
          type: 'init',
          payload: { name: 'client1', actions: { listensOn: ['core.run'] } },
        }) + '\n'
      );

      client.on('data', (chunk) => {
        const chunkString = chunk.toString('utf-8').split('\n')[0];

        const msg = JSON.parse(chunkString);

        if (msg.type === 'event' && msg.payload.name === 'core.run') {
          const report: ThymianReport = {
            isProblem: false,
            text: '',
            title: '',
            topic: '',
          };

          const reportEvent: ThymianEvent<'core.report'> = {
            id: 'abc123',
            name: 'core.report',
            payload: report,
            source: 'client1',
            timestamp: 293842,
          };

          client.write(
            JSON.stringify({ type: 'event', payload: reportEvent }) + '\n'
          );

          const responseEvent: ThymianResponseEvent<'core.run'> = {
            correlationId: msg.payload.id,
            id: '123abc',
            name: 'core.run',
            payload: {
              pluginName: 'client1',
              status: 'success',
            },
            source: '',
            timestamp: 0,
          };

          client.write(
            JSON.stringify({ type: 'response', payload: responseEvent }) + '\n'
          );
        }
      });
    });

    await runPromise;

    console.log(
      await emitter.emitAction('core.run', new ThymianFormat().export())
    );
    console.log('test');

    expect(reportFn).toHaveBeenCalled();
  });
});
