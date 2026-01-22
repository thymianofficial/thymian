import * as http from 'node:http';
import { join } from 'node:path';

import { NoopLogger } from '@thymian/core';
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
  });
});
