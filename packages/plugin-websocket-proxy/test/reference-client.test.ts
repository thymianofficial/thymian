import { Thymian, ThymianEmitter, ThymianFormat } from '@thymian/core';
import { describe, expect, it, vitest } from 'vitest';

import { websocketProxyPlugin } from '../src';
import { ReferenceClient } from './reference-client';

describe('Reference Client', () => {
  it('should work', async () => {
    const thymian = new Thymian();

    const client = new ReferenceClient(
      45678,
      'remote-plugin',
      ['core.run'],
      [],
    );

    client.onAction('core.run', () => {
      client.emitEvent('core.report', {
        topic: client.options.key,
        title: 'B',
        text: 'C',
        isProblem: true,
      });
    });

    const reportFn = vitest.fn();

    thymian
      .register(websocketProxyPlugin, {
        port: 45678,
        plugins: [
          {
            name: 'remote-plugin',
            required: true,
            options: {
              key: 'turing',
            },
          },
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

    await Promise.all([thymian.ready(), client.init()]);

    await thymian.emitter.emitAction('core.run', new ThymianFormat().export());

    await client.emitEvent('core.report', {
      topic: 'A',
      title: 'B',
      text: 'C',
      isProblem: true,
    });

    await thymian.close();

    expect(reportFn).toBeCalledTimes(2);
    expect(reportFn).toBeCalledWith({
      topic: 'turing',
      title: 'B',
      text: 'C',
      isProblem: true,
    });
    expect(reportFn).toBeCalledWith({
      topic: 'A',
      title: 'B',
      text: 'C',
      isProblem: true,
    });
  });
});
