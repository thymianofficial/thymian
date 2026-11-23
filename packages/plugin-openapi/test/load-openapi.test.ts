import * as http from 'node:http';
import { join } from 'node:path';

import {
  constant,
  NoopLogger,
  ThymianBaseError,
  type ThymianFormat,
} from '@thymian/core';
import type { OpenAPIV3_1 } from 'openapi-types';
import { beforeAll, describe, expect, it, vitest } from 'vitest';
import yaml from 'yaml';

import {
  loadAndUpgrade,
  openapiToThymianFormat,
  validateOpenApi,
} from '../src/load-openapi.js';

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

    it('throws OpenAPIFileNotFoundError when file does not exist', async () => {
      try {
        await loadAndUpgrade(
          'nonexistent-file.yaml',
          process.cwd(),
          new NoopLogger(),
        );
        expect.fail('Error should have been thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ThymianBaseError);
        expect((error as ThymianBaseError).options.name).toBe(
          'OpenAPIFileNotFoundError',
        );
        expect((error as ThymianBaseError).options.ref).toBe(
          'https://thymian.dev/references/errors/openapi-file-not-found-error/',
        );
        expect(String(error)).toContain('nonexistent-file.yaml');
      }
    });

    it('throws OpenAPIValidationError when validation fails and validateSpecs is enabled', async () => {
      const invalidDocument = {
        swagger: '2.0',
        info: {
          // Missing required 'title' field
          version: '1.0.0',
        },
        paths: {},
      };

      try {
        await loadAndUpgrade(
          JSON.stringify(invalidDocument),
          process.cwd(),
          new NoopLogger(),
          true,
        );
        expect.fail('Error should have been thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ThymianBaseError);
        expect((error as ThymianBaseError).options.name).toBe(
          'OpenAPIValidationError',
        );
        expect((error as ThymianBaseError).options.ref).toBe(
          'https://thymian.dev/references/errors/openapi-validation-error/',
        );
        expect(String(error)).toContain('validation');
      }
    });

    it('throws OpenAPIDereferenceError when $ref cannot be resolved', async () => {
      const documentWithBadRef = {
        openapi: '3.1.0',
        info: {
          title: 'Test',
          version: '1.0.0',
        },
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        $ref: '#/components/schemas/NonExistent',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      try {
        await loadAndUpgrade(
          JSON.stringify(documentWithBadRef),
          process.cwd(),
          new NoopLogger(),
        );
        expect.fail('Error should have been thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ThymianBaseError);
        expect((error as ThymianBaseError).options.name).toBe(
          'OpenAPIDereferenceError',
        );
        expect((error as ThymianBaseError).options.ref).toBe(
          'https://thymian.dev/references/errors/openapi-dereference-error/',
        );
        expect((error as ThymianBaseError).options.suggestions).toEqual([
          'Ensure every $ref points to an existing location: a JSON pointer within its document, a file path (relative paths resolve against the document containing the $ref), or a reachable URL.',
        ]);
      }
    });

    it('warns but does not throw on schema validation failure when validateSpecs is false', async () => {
      const invalidDocument = {
        swagger: '2.0',
        info: {
          // Missing required 'title' field
          version: '1.0.0',
        },
        paths: {},
      };

      const logger = new NoopLogger();
      const wantSpy = vitest.spyOn(logger, 'warn');

      const result = await loadAndUpgrade(
        JSON.stringify(invalidDocument),
        process.cwd(),
        logger,
        false,
      );

      // Should succeed — validation ran but only warned
      expect(result.document.openapi).toBe('3.1.1');
      expect(wantSpy).toHaveBeenCalledTimes(1);
    });

    it('still throws on $ref errors when validateSpecs is false', async () => {
      const documentWithBadRef = {
        openapi: '3.1.0',
        info: {
          title: 'Test',
          version: '1.0.0',
        },
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        $ref: '#/components/schemas/NonExistent',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      try {
        await loadAndUpgrade(
          JSON.stringify(documentWithBadRef),
          process.cwd(),
          new NoopLogger(),
          false,
        );
        expect.fail('Error should have been thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ThymianBaseError);
        expect((error as ThymianBaseError).options.name).toBe(
          'OpenAPIDereferenceError',
        );
      }
    });

    it('loads a path item $ref with validateSpecs enabled', async () => {
      const result = await loadAndUpgrade(
        join(import.meta.dirname, 'fixtures/path-item-ref.yaml'),
        process.cwd(),
        new NoopLogger(),
        true,
      );

      expect(result.document.paths?.['/u']).toEqual({
        $ref: '#/components/pathItems/U',
      });
    });

    it('does not warn about a path item $ref when validateSpecs is false', async () => {
      const logger = new NoopLogger();
      const warnSpy = vitest.spyOn(logger, 'warn');

      await loadAndUpgrade(
        join(import.meta.dirname, 'fixtures/path-item-ref.yaml'),
        process.cwd(),
        logger,
        false,
      );

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('still throws OpenAPIValidationError for a real schema error next to a path item $ref', async () => {
      try {
        await loadAndUpgrade(
          join(
            import.meta.dirname,
            'fixtures/path-item-ref-with-schema-error.yaml',
          ),
          process.cwd(),
          new NoopLogger(),
          true,
        );
        expect.fail('Error should have been thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ThymianBaseError);
        expect((error as ThymianBaseError).options.name).toBe(
          'OpenAPIValidationError',
        );
        const cause = (error as ThymianBaseError).cause as Error;
        expect(cause.message).toBe("must have required property 'description'");
      }
    });

    it('returns upgraded documents without fully dereferencing recursive schemas', async () => {
      const document = {
        openapi: '3.1.0',
        info: {
          title: 'Recursive Test',
          version: '1.0.0',
        },
        paths: {
          '/nodes': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        $ref: '#/components/schemas/Node',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            Node: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                child: { $ref: '#/components/schemas/Node' },
              },
            },
          },
        },
      };

      const result = await loadAndUpgrade(
        JSON.stringify(document),
        process.cwd(),
        new NoopLogger(),
      );

      expect(
        result.document.paths?.['/nodes']?.get?.responses?.['200'],
      ).toStrictEqual({
        description: 'OK',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Node',
            },
          },
        },
      });
      expect(result.document.components?.schemas?.Node).toStrictEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          child: { $ref: '#/components/schemas/Node' },
        },
      });
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

    it('should create separate response nodes for identical responses', async () => {
      const document: OpenAPIV3_1.Document = {
        openapi: '3.1.0',
        info: {
          title: 'Min API',
          version: '1.0.0',
        },
        paths: {
          '/a': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                },
              },
            },
          },
          '/b': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
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

      // Should have 2 transactions (one for each request)
      expect(transactions.length).toBe(2);

      // Should have 2 request nodes
      const requests = format.getThymianHttpRequests();
      expect(requests.length).toBe(2);

      // Should have 2 distinct response nodes (not 1 shared node)
      const responseIds = new Set(transactions.map((t) => t.thymianResId));
      expect(responseIds.size).toBe(2);

      // Verify that the responses are not the same object
      expect(transactions[0]?.thymianResId).not.toBe(
        transactions[1]?.thymianResId,
      );
    });

    it('transforms non-dereferenced OpenAPI references lazily', async () => {
      const document: OpenAPIV3_1.Document = {
        openapi: '3.1.0',
        info: {
          title: 'Referenced API',
          version: '1.0.0',
        },
        paths: {
          '/users/{id}': {
            $ref: '#/components/pathItems/UserPath',
          },
        },
        components: {
          pathItems: {
            UserPath: {
              parameters: [{ $ref: '#/components/parameters/UserId' }],
              get: {
                operationId: 'getUser',
                requestBody: { $ref: '#/components/requestBodies/UserFilter' },
                responses: {
                  '200': { $ref: '#/components/responses/UserResponse' },
                },
                security: [{ BearerAuth: [] }],
              },
            },
          },
          parameters: {
            UserId: {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          },
          requestBodies: {
            UserFilter: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/UserFilter' },
                },
              },
            },
          },
          responses: {
            UserResponse: {
              description: 'User',
              headers: {
                'x-trace-id': { $ref: '#/components/headers/TraceId' },
              },
              links: {
                related: { $ref: '#/components/links/RelatedUser' },
              },
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' },
                  examples: {
                    default: { $ref: '#/components/examples/UserExample' },
                  },
                },
              },
            },
          },
          headers: {
            TraceId: {
              schema: { type: 'string' },
            },
          },
          links: {
            RelatedUser: {
              operationId: 'getUser',
              parameters: {
                'path.id': '$response.body#/id',
              },
            },
          },
          examples: {
            UserExample: {
              value: {
                id: '123',
                name: 'Jane',
              },
            },
          },
          securitySchemes: {
            BearerAuth: {
              $ref: '#/components/securitySchemes/BearerAuthConcrete',
            },
            BearerAuthConcrete: {
              type: 'http',
              scheme: 'bearer',
            },
          },
          schemas: {
            UserFilter: {
              type: 'object',
              properties: {
                includeInactive: { type: 'boolean' },
              },
            },
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
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

      const [transaction] = format.getThymianHttpTransactions();

      expect(transaction?.thymianReq.pathParameters.id).toMatchObject({
        required: true,
        schema: { type: 'string' },
      });
      expect(transaction?.thymianReq.body).toMatchObject({
        $ref: '#/$defs/UserFilter',
        $defs: {
          UserFilter: {
            type: 'object',
            properties: {
              includeInactive: { type: 'boolean' },
            },
          },
        },
      });
      expect(transaction?.thymianRes.headers['x-trace-id']).toMatchObject({
        schema: { type: 'string' },
      });
      expect(transaction?.thymianRes.schema).toMatchObject({
        $ref: '#/$defs/User',
        $defs: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      });
      expect(
        format.graph.filterNodes((_, node) => node.type === 'security-scheme'),
      ).toHaveLength(2);
      expect(
        format.graph.filterEdges((_, edge) => edge.type === 'http-link'),
      ).toHaveLength(1);
    });
  });

  describe('split spec with cross-file $refs', () => {
    let format: ThymianFormat;

    const transactionsFor = (path: string, statusCode: number) =>
      format
        .getThymianHttpTransactions()
        .filter(
          (t) =>
            t.thymianReq.path === path &&
            t.thymianRes.statusCode === statusCode,
        );

    beforeAll(async () => {
      const { document } = await loadAndUpgrade(
        join(import.meta.dirname, 'fixtures/split/openapi.yaml'),
        process.cwd(),
        new NoopLogger(),
      );

      format = await openapiToThymianFormat(document, {
        filter: constant(true),
        serverInfo: {
          basePath: '',
          port: 8080,
          host: 'localhost',
          protocol: 'http',
        },
      });
    });

    it('resolves a path item $ref to another file', () => {
      expect(transactionsFor('/users/{id}', 200)).toHaveLength(1);
      expect(transactionsFor('/users/{id}', 404)).toHaveLength(1);
    });

    it('resolves a parameter $ref into another file', () => {
      const [transaction] = transactionsFor('/users/{id}', 200);

      expect(transaction?.thymianReq.pathParameters.id).toMatchObject({
        required: true,
        schema: { type: 'string' },
      });
    });

    it('resolves a ref to a sibling schema within an external file', () => {
      const [transaction] = transactionsFor('/users/{id}', 200);

      expect(transaction?.thymianRes.schema).toMatchObject({
        $defs: {
          User: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              address: { $ref: '#/$defs/Address' },
            },
          },
          Address: {
            type: 'object',
            properties: { city: { type: 'string' } },
          },
        },
      });
    });

    it('resolves a ref from an external file back into the root document', () => {
      const [transaction] = transactionsFor('/users/{id}', 404);

      expect(transaction?.thymianRes.schema).toMatchObject({
        $ref: '#/$defs/Error',
        $defs: {
          Error: {
            type: 'object',
            properties: { msg: { type: 'string' } },
          },
        },
      });
    });

    it('resolves a self-recursive schema in an external file', () => {
      const [transaction] = transactionsFor('/nodes', 200);
      const schema = transaction?.thymianRes.schema as {
        $ref: string;
        $defs: Record<string, { properties: { child: { $ref: string } } }>;
      };
      const key = schema.$ref.replace('#/$defs/', '');

      expect(schema.$defs[key]?.properties.child.$ref).toBe(schema.$ref);
    });

    it('throws OpenAPIDereferenceError naming a missing external file', async () => {
      try {
        await loadAndUpgrade(
          join(import.meta.dirname, 'fixtures/missing-ref.yaml'),
          process.cwd(),
          new NoopLogger(),
        );
        expect.fail('Error should have been thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ThymianBaseError);
        const thymianError = error as ThymianBaseError;
        expect(thymianError.options.name).toBe('OpenAPIDereferenceError');
        expect((thymianError.cause as Error).message).toContain(
          'schemas/missing.yaml',
        );
        expect(thymianError.message).toContain('schemas/missing.yaml');
        expect(thymianError.message).not.toContain('internal');
        expect(thymianError.options.suggestions).toEqual([
          'Ensure every $ref points to an existing location: a JSON pointer within its document, a file path (relative paths resolve against the document containing the $ref), or a reachable URL.',
          'Check that each referenced file or URL exists and is readable, and that relative paths are spelled correctly.',
        ]);
      }
    });

    it('lists missing files and unresolved pointers in separate clauses', async () => {
      try {
        await loadAndUpgrade(
          join(import.meta.dirname, 'fixtures/missing-refs-mixed.yaml'),
          process.cwd(),
          new NoopLogger(),
        );
        expect.fail('Error should have been thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ThymianBaseError);
        const { message } = error as ThymianBaseError;
        expect(message).toContain(
          "Referenced files could not be loaded: './schemas/missing-a.yaml', './schemas/missing-b.yaml' (resolved relative to the document containing the $ref).",
        );
        expect(message).toContain(
          "Invalid $ref found: Can't resolve reference: #/components/schemas/NonExistent.",
        );
      }
    });

    it('omits the relative-resolution note for an absolute $ref path', async () => {
      const documentWithAbsoluteRef = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: { $ref: '/abs/missing.yaml#/X' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      await expect(
        loadAndUpgrade(
          JSON.stringify(documentWithAbsoluteRef),
          process.cwd(),
          new NoopLogger(),
        ),
      ).rejects.toMatchObject({
        message: "Referenced file could not be loaded: '/abs/missing.yaml'.",
      });
    });

    it('strips credentials and query string from a URL $ref in the headline only', async () => {
      const rawUrl = 'https://user:secret@nonexistent.invalid/s.yaml?token=abc';
      const documentWithUrlRef = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': { schema: { $ref: rawUrl } },
                  },
                },
              },
            },
          },
        },
      };

      try {
        await loadAndUpgrade(
          JSON.stringify(documentWithUrlRef),
          process.cwd(),
          new NoopLogger(),
        );
        expect.fail('Error should have been thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ThymianBaseError);
        const thymianError = error as ThymianBaseError;
        expect(thymianError.message).toContain(
          "'https://nonexistent.invalid/s.yaml'",
        );
        expect(thymianError.message).not.toContain('secret');
        expect(thymianError.message).not.toContain('token');
        expect((thymianError.cause as Error).message).toContain(rawUrl);
      }
    });

    it('names a missing external file when dereferencing a schema-invalid document', async () => {
      await expect(
        loadAndUpgrade(
          'fixtures/missing-ref-with-schema-error.yaml',
          import.meta.dirname,
          new NoopLogger(),
          false,
        ),
      ).rejects.toMatchObject({
        options: { name: 'OpenAPIDereferenceError' },
        message:
          "Referenced file could not be loaded: './schemas/missing.yaml' (resolved relative to the document containing the $ref).",
      });
    });

    it('names a missing external file and an unresolved pointer when dereferencing a schema-invalid document', async () => {
      const label = join(
        'fixtures',
        'missing-ref-and-pointer-with-schema-error.yaml',
      );

      await expect(
        loadAndUpgrade(
          'fixtures/missing-ref-and-pointer-with-schema-error.yaml',
          import.meta.dirname,
          new NoopLogger(),
          false,
        ),
      ).rejects.toMatchObject({
        options: { name: 'OpenAPIDereferenceError' },
        message: `Referenced file could not be loaded: './schemas/missing.yaml' (resolved relative to the document containing the $ref). Resolving the $refs in '${label}' failed: Can't resolve reference: #/components/schemas/NonExistent.`,
      });
    });

    it('throws OpenAPIDereferenceError for a missing external file when validateSpecs is enabled', async () => {
      try {
        await loadAndUpgrade(
          join(import.meta.dirname, 'fixtures/missing-ref.yaml'),
          process.cwd(),
          new NoopLogger(),
          true,
        );
        expect.fail('Error should have been thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ThymianBaseError);
        expect((error as ThymianBaseError).options.name).toBe(
          'OpenAPIDereferenceError',
        );
      }
    });
  });

  describe('validateOpenApi', () => {
    it('returns failed result for schema-invalid documents', async () => {
      const result = await validateOpenApi(
        'test/fixtures/invalid-openapi.yaml',
        {
          cwd: join(import.meta.dirname, '..'),
          logger: new NoopLogger(),
        },
      );

      expect(result.status).toBe('failed');
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('returns success result for valid documents', async () => {
      const result = await validateOpenApi('test/fixtures/petstore-v2.yaml', {
        cwd: join(import.meta.dirname, '..'),
        logger: new NoopLogger(),
      });

      expect(result).toEqual(
        expect.objectContaining({
          type: 'openapi',
          status: 'success',
          issues: [],
        }),
      );
    });

    it('returns success result for a document with a path item $ref', async () => {
      const result = await validateOpenApi('test/fixtures/path-item-ref.yaml', {
        cwd: join(import.meta.dirname, '..'),
        logger: new NoopLogger(),
      });

      expect(result).toEqual(
        expect.objectContaining({
          type: 'openapi',
          status: 'success',
          issues: [],
        }),
      );
    });

    it('returns error result for load failures instead of throwing', async () => {
      const result = await validateOpenApi(
        'test/fixtures/missing-openapi.yaml',
        {
          cwd: join(import.meta.dirname, '..'),
          logger: new NoopLogger(),
        },
      );

      expect(result).toEqual(
        expect.objectContaining({
          type: 'openapi',
          location: 'test/fixtures/missing-openapi.yaml',
          source: 'test/fixtures/missing-openapi.yaml',
          status: 'error',
          issues: [
            expect.objectContaining({
              code: 'OpenAPIFileNotFoundError',
            }),
          ],
        }),
      );
    });

    it('returns failed result for invalid references', async () => {
      const result = await validateOpenApi(
        JSON.stringify({
          openapi: '3.1.0',
          info: {
            title: 'Test',
            version: '1.0.0',
          },
          paths: {
            '/test': {
              get: {
                responses: {
                  '200': {
                    description: 'OK',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/Missing',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        {
          cwd: join(import.meta.dirname, '..'),
          logger: new NoopLogger(),
        },
      );

      expect(result.status).toBe('failed');
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('reports reference errors for a missing external file', async () => {
      const result = await validateOpenApi('test/fixtures/missing-ref.yaml', {
        cwd: join(import.meta.dirname, '..'),
        logger: new NoopLogger(),
      });

      expect(result.status).toBe('failed');
      expect(result.metadata?.['hasReferenceErrors']).toBe(true);
    });
  });
});
