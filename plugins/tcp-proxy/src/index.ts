import type { PartialBy, ThymianPlugin } from '@thymian/core';

import { TcpProxyServer, type TcpServerOptions } from './tcp-proxy-server.js';

export const tcpProxyPlugin: ThymianPlugin<
  PartialBy<TcpServerOptions, 'port' | 'timeout'>
> = {
  name: '@thymian/tcp-proxy',
  version: '0.x',
  async plugin(emitter, logger, options) {
    const opts: TcpServerOptions = {
      port: 48294,
      timeout: 2000,
      ...options,
    };

    await new TcpProxyServer(logger, emitter, opts).run();
  },
};
