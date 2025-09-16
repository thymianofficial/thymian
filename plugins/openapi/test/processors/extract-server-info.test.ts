import { describe, expect, it } from 'vitest';

import { extractServerInfo } from '../../src/processors/extract-server-info.js';

describe('extractServerInfo', () => {
  it('should set variables', () => {
    const serverInfo = extractServerInfo([
      {
        url: 'http://localhost:{port}/{basePath}',
        variables: {
          port: {
            default: '3000',
          },
          basePath: {
            default: 'api',
          },
        },
      },
    ]);

    expect(serverInfo).toMatchObject({
      basePath: '/api',
      host: 'localhost',
      port: 3000,
      protocol: 'http',
    });
  });
});
