import { constant, NoopLogger, path as pathFilter } from '@thymian/core';
import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';
import { describe, expect, it } from 'vitest';

import { NoopLocMapper } from '../../src/loc-mapper/noop-loc-mapper.js';
import type { ServerInfo } from '../../src/processors/extract-server-info.js';
import { OpenapiProcessor } from '../../src/processors/openapi.processor.js';

const serverInfoWithBasePath: ServerInfo = {
  // as produced by extractServerInfo from `servers: [{ url: 'http://localhost:8080/v1' }]`
  basePath: '/v1',
  host: 'localhost',
  port: 8080,
  protocol: 'http',
};

const document: OpenApiV31.Document = {
  openapi: '3.1.0',
  info: {
    title: 'Test API',
    version: '1.0.0',
  },
  paths: {
    '/pets': {
      get: {
        responses: {
          '200': { description: 'OK' },
        },
      },
    },
    '/pets/{petId}': {
      get: {
        parameters: [
          {
            name: 'petId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'OK' },
        },
      },
    },
  },
};

function requestPaths(
  serverInfo: ServerInfo,
  filter = constant(true),
): string[] {
  return new OpenapiProcessor(new NoopLogger(), serverInfo, new NoopLocMapper())
    .process(document, filter)
    .getThymianHttpTransactions()
    .map((transaction) => transaction.thymianReq.path);
}

describe('OpenapiProcessor', () => {
  it('prefixes every operation path with the base path of the server', () => {
    expect(requestPaths(serverInfoWithBasePath)).toStrictEqual([
      '/v1/pets',
      '/v1/pets/{petId}',
    ]);
  });

  it('keeps the path rooted when the server has no base path', () => {
    expect(
      requestPaths({ ...serverInfoWithBasePath, basePath: '' }),
    ).toStrictEqual(['/pets', '/pets/{petId}']);
  });

  it('joins the base path the same way the path filter does', () => {
    // the filter and the graph must agree, otherwise a selector matches an
    // operation whose req.path reads differently (thymian-internal#621)
    expect(
      requestPaths(serverInfoWithBasePath, pathFilter('/v1/pets')),
    ).toStrictEqual(['/v1/pets']);
  });

  it('never puts a platform separator into req.path', () => {
    // Passes on POSIX either way — node:path's join and posix.join are the same
    // implementation there. This assertion only bites on CI's windows-2022 job,
    // where the old node:path join produced `\v1\pets` (thymian-internal#621).
    for (const path of requestPaths(serverInfoWithBasePath)) {
      expect(path).not.toContain('\\');
    }
  });
});
