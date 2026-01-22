import * as http from 'node:http';
import { join } from 'node:path';

import { constant, NoopLogger } from '@thymian/core';
import type { OpenAPIV3_1 } from 'openapi-types';
import { describe, expect, it } from 'vitest';
import yaml from 'yaml';

import { loadAndUpgrade, openapiToThymianFormat } from '../src/load-openapi.js';

const swaggerDocument = {
  swagger: '2.0',
  info: {
    version: '',
    title: '',
  },
  paths: {},
  definitions: {
    Foo: {
      type: 'object',
    },
  },
};

describe('load-openapi', () => {
  describe('loadAndUpgrade', () => {
    it('loads and upgrades swagger document from JSON string', async () => {
      const result = await loadAndUpgrade(
        JSON.stringify(swaggerDocument),
        process.cwd(),
        new NoopLogger(),
      );

      expect(result.document.openapi).toBe('3.1.1');
    });

    it('loads and upgrades swagger document from YAML string', async () => {
      const result = await loadAndUpgrade(
        yaml.stringify(swaggerDocument),
        process.cwd(),
        new NoopLogger(),
      );

      expect(result.document.openapi).toBe('3.1.1');
    });

    it('loads and upgrades swagger document from JSON file', async () => {
      const result = await loadAndUpgrade(
        join(import.meta.dirname, 'fixtures/simple-swagger.json'),
        process.cwd(),
        new NoopLogger(),
      );

      expect(result.document.openapi).toBe('3.1.1');
    });

    it('loads and upgrades swagger document from YAML file', async () => {
      const result = await loadAndUpgrade(
        join(import.meta.dirname, 'fixtures/simple-swagger.yaml'),
        process.cwd(),
        new NoopLogger(),
      );

      expect(result.document.openapi).toBe('3.1.1');
    });

    it('loads and upgrades swagger document from YAML file server', async () => {
      const server = http.createServer((req, res) => {
        const body = JSON.stringify(swaggerDocument);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
        });
        res.end(body);
      });

      const started = new Promise((resolve) => server.on('listening', resolve));

      server.listen(3412);

      await started;

      const result = await loadAndUpgrade(
        'http://localhost:3412',
        process.cwd(),
        new NoopLogger(),
      );

      expect(result.document.openapi).toBe('3.1.1');

      server.closeAllConnections();

      await new Promise((resolve) => server.close(resolve));
    });
  });

  describe('openapiToThymianFormat', () => {
    it('throws error for non supported openapi version', async () => {
      await expect(
        async () =>
          await openapiToThymianFormat(
            swaggerDocument as unknown as OpenAPIV3_1.Document,
            {
              filter: constant(true),
              serverInfo: {
                basePath: '',
                port: 8080,
                host: 'localhost',
                protocol: 'http',
              },
            },
          ),
      ).rejects.toThrowError();
    });

    it('should apply filter to operations', async () => {
      const document: OpenAPIV3_1.Document = {
        openapi: '3.1.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {
          '/users': {
            get: {
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                  },
                },
              },
              responses: {
                '201': {
                  description: 'Created',
                },
              },
            },
          },
        },
      };

      const format = await openapiToThymianFormat(document, {
        filter: { type: 'method', method: 'get', kind: 'request' },
        serverInfo: {
          basePath: '',
          port: 8080,
          host: 'localhost',
          protocol: 'http',
        },
      });

      const transactions = format.getThymianHttpTransactions();
      expect(transactions.length).toBe(1);
      expect(transactions[0]?.thymianReq.method).toBe('get');
    });

    it('should set sourceName on transactions', async () => {
      const document: OpenAPIV3_1.Document = {
        openapi: '3.1.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {
          '/users': {
            get: {
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
          },
        },
      };

      const format = await openapiToThymianFormat(document, {
        filter: constant(true),
        serverInfo: {
          basePath: '',
          port: 8080,
          host: 'localhost',
          protocol: 'http',
        },
        sourceName: 'test-source',
      });

      const transactions = format.getThymianHttpTransactions();
      expect(transactions.length).toBeGreaterThan(0);
      transactions.forEach((t) => {
        expect(t.thymianReq.sourceName).toBe('test-source');
        expect(t.thymianRes.sourceName).toBe('test-source');
      });
    });

    it('should use default sourceName when not provided', async () => {
      const document: OpenAPIV3_1.Document = {
        openapi: '3.1.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {
          '/users': {
            get: {
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
          },
        },
      };

      const format = await openapiToThymianFormat(document, {
        filter: constant(true),
        serverInfo: {
          basePath: '',
          port: 8080,
          host: 'localhost',
          protocol: 'http',
        },
      });

      const transactions = format.getThymianHttpTransactions();
      expect(transactions.length).toBeGreaterThan(0);
      transactions.forEach((t) => {
        expect(t.thymianReq.sourceName).toBeDefined();
        expect(t.thymianRes.sourceName).toBeDefined();
      });
    });

    it('should filter by request media type', async () => {
      const document: OpenAPIV3_1.Document = {
        openapi: '3.1.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {
          '/users': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                  },
                },
              },
              responses: {
                '201': {
                  description: 'Created',
                },
              },
            },
            put: {
              requestBody: {
                content: {
                  'application/xml': {
                    schema: { type: 'object' },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Updated',
                },
              },
            },
          },
        },
      };

      const format = await openapiToThymianFormat(document, {
        filter: {
          type: 'requestMediaType',
          mediaType: 'application/json',
          kind: 'request',
        },
        serverInfo: {
          basePath: '',
          port: 8080,
          host: 'localhost',
          protocol: 'http',
        },
      });

      const transactions = format.getThymianHttpTransactions();
      expect(transactions.length).toBeGreaterThan(0);
      transactions.forEach((t) => {
        expect(t.thymianReq.mediaType).toBe('application/json');
      });
    });

    it('should return empty format when filter matches nothing', async () => {
      const document: OpenAPIV3_1.Document = {
        openapi: '3.1.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {
          '/users': {
            get: {
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
          },
        },
      };

      const format = await openapiToThymianFormat(document, {
        filter: { type: 'method', method: 'delete', kind: 'request' },
        serverInfo: {
          basePath: '',
          port: 8080,
          host: 'localhost',
          protocol: 'http',
        },
      });

      const transactions = format.getThymianHttpTransactions();
      expect(transactions.length).toBe(0);
    });
  });
});
