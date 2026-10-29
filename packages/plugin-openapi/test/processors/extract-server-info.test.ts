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

  it('should prefer a localhost server over the first server', () => {
    const serverInfo = extractServerInfo([
      { url: 'https://api.example.com/v1' },
      { url: 'http://localhost:3000/api' },
    ]);

    expect(serverInfo).toMatchObject({
      basePath: '/api',
      host: 'localhost',
      port: 3000,
      protocol: 'http',
    });
  });

  it('should use the first server when none is on localhost', () => {
    const serverInfo = extractServerInfo([
      { url: 'https://api.example.com/v1' },
      { url: 'https://staging.example.com/v2' },
    ]);

    expect(serverInfo).toMatchObject({
      basePath: '/v1',
      host: 'api.example.com',
      port: 443,
      protocol: 'https',
    });
  });
});
