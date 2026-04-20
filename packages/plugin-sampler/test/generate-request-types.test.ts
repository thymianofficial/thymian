import { ThymianFormat } from '@thymian/core';
import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import {
  generatedTypesToString,
  generateTypesForThymianFormat,
} from '../src/hooks/generate-request-types.js';

describe('generateRequestTypes', () => {
  it(
    'should generate request type definitions as a string - small',
    { timeout: 10000 },
    async () => {
      const format = new ThymianFormat();

      const [, , transactionId] = format.addHttpTransaction(
        {
          cookies: {},
          headers: {},
          host: 'localhost',
          label: '',
          mediaType: '',
          method: 'GET',
          path: '/users/{username}/orders',
          pathParameters: {},
          port: 8080,
          protocol: 'http',
          queryParameters: {
            limit: {
              schema: { type: 'number' },
              required: true,
              style: { style: 'form', explode: true },
            },
          },
          type: 'http-request',
          body: {
            type: 'object',
            properties: {
              username: { type: 'string' },
            },
          },
        },
        {
          headers: {},
          label: '',
          mediaType: 'application/json',
          statusCode: 200,
          type: 'http-response',
        },
        '',
      );

      const result = await generateTypesForThymianFormat(format);

      expect(result.keyToTransactionId).toMatchObject({
        'GET http://localhost:8080/users/{username}/orders': transactionId,
      });

      const dtsContent = generatedTypesToString(result.types);

      const project = new Project({
        skipAddingFilesFromTsConfig: true,
        compilerOptions: {
          strict: true,
        },
      });
      const sourceFile = project.createSourceFile('generated.d.ts', dtsContent);
      const diagnostics = sourceFile.getPreEmitDiagnostics();

      expect(
        diagnostics.length,
        'Generated source file should not emit any diagnostics',
      ).toBe(0);
    },
  );

  it(
    'should generate request type definitions as a string - large',
    { timeout: 10_000 },
    async () => {
      const format = ThymianFormat.import(
        {
          options: { type: 'directed', multi: true, allowSelfLoops: true },
          attributes: { hash: '' },
          nodes: [
            {
              key: 'ff4df09d-9c26-4903-81c7-3643b384b7c4',
              attributes: {
                label: '',
                type: 'http-request',
                host: 'localhost',
                port: 8080,
                protocol: 'http',
                path: '/projects',
                method: 'get',
                mediaType: '',
                extensions: { openapiV3: {} },
                cookies: {},
                pathParameters: {},
                queryParameters: {},
                headers: {},
              },
            },
            {
              key: 'bf76d1f8-fae9-464d-8025-2eb4ab88ec8a',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 200,
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      description: { type: 'string' },
                    },
                    required: ['id', 'name'],
                  },
                },
              },
            },
            {
              key: 'f52fba20-4e21-460b-b0bb-10c14aa448a2',
              attributes: {
                label: '',
                type: 'http-request',
                host: 'localhost',
                port: 8080,
                protocol: 'http',
                path: '/projects',
                method: 'post',
                bodyRequired: true,
                body: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                  },
                  required: ['name'],
                },
                mediaType: 'application/json',
                extensions: { openapiV3: {} },
                queryParameters: {},
                cookies: {},
                pathParameters: {},
                headers: {},
              },
            },
            {
              key: '17edfa3a-598e-40ba-9e8d-872f6cd38176',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 201,
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                  },
                  required: ['id', 'name'],
                },
              },
            },
            {
              key: 'af62f2b5-0197-44ae-80a0-d381efee468a',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 400,
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                },
              },
            },
            {
              key: '64338bca-eda4-4dcb-b822-ad3c7703cd78',
              attributes: {
                label: '',
                type: 'http-request',
                host: 'localhost',
                port: 8080,
                protocol: 'http',
                path: '/projects/{id}',
                method: 'get',
                mediaType: '',
                extensions: { openapiV3: {} },
                cookies: {},
                pathParameters: {
                  id: {
                    required: true,
                    schema: { type: 'string', examples: ['1'] },
                    style: { style: 'simple', explode: false },
                  },
                },
                queryParameters: {},
                headers: {},
              },
            },
            {
              key: 'eb0097f0-1252-4d7a-b5f0-d4645a7d1270',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 200,
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                  },
                  required: ['id', 'name'],
                },
              },
            },
            {
              key: 'eb813cce-5e95-4f7a-9ed8-a4523a3f93cf',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 404,
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                },
              },
            },
            {
              key: 'a2e8d334-fc8e-4ab2-ba9e-0fe0de34b18f',
              attributes: {
                label: '',
                type: 'http-request',
                host: 'localhost',
                port: 8080,
                protocol: 'http',
                path: '/projects/{id}',
                method: 'delete',
                mediaType: '',
                extensions: { openapiV3: {} },
                cookies: {},
                pathParameters: {
                  id: {
                    required: true,
                    schema: { type: 'string' },
                    style: { style: 'simple', explode: false },
                  },
                },
                queryParameters: {},
                headers: {},
              },
            },
            {
              key: '745b1b85-da18-4fc0-9382-0829ea0cd3e6',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: '',
                statusCode: 204,
              },
            },
            {
              key: '0e5523c2-ad5c-476c-9335-1e522e56311d',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 404,
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                },
              },
            },
            {
              key: '7a8a1884-c467-4e2b-8146-92c7f76b99f8',
              attributes: {
                label: '',
                type: 'http-request',
                host: 'localhost',
                port: 8080,
                protocol: 'http',
                path: '/projects/{id}/todos',
                method: 'post',
                bodyRequired: true,
                body: {
                  type: 'object',
                  properties: { title: { type: 'string' } },
                  required: ['title'],
                },
                mediaType: 'application/json',
                extensions: { openapiV3: {} },
                queryParameters: {},
                cookies: {},
                pathParameters: {
                  id: {
                    required: true,
                    schema: { type: 'string' },
                    style: { style: 'simple', explode: false },
                  },
                },
                headers: {},
              },
            },
            {
              key: '55a5ca94-282a-40e6-9c36-67ec9915ccc4',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 201,
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    done: { type: 'boolean' },
                    projectId: { type: ['null', 'string'] },
                  },
                  required: ['id', 'title', 'done'],
                },
              },
            },
            {
              key: 'a1bd73ac-f4a2-40e8-9e10-ac5f5128fa3e',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 400,
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                },
              },
            },
            {
              key: '0b856f44-865a-4781-9d82-1ce95089c30a',
              attributes: {
                label: '',
                type: 'http-request',
                host: 'localhost',
                port: 8080,
                protocol: 'http',
                path: '/projects/{id}/todos',
                method: 'get',
                mediaType: '',
                extensions: { openapiV3: {} },
                cookies: {},
                pathParameters: {
                  id: {
                    required: true,
                    schema: { type: 'string' },
                    style: { style: 'simple', explode: false },
                  },
                },
                queryParameters: {},
                headers: {},
              },
            },
            {
              key: 'dfc47bcb-6d11-4c44-92a0-c11e6dd2d991',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 200,
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      done: { type: 'boolean' },
                      projectId: { type: ['null', 'string'] },
                    },
                    required: ['id', 'title', 'done'],
                  },
                },
              },
            },
            {
              key: '6873b02b-73aa-4410-818a-53874d51d69a',
              attributes: {
                label: '',
                type: 'http-request',
                host: 'localhost',
                port: 8080,
                protocol: 'http',
                path: '/todos',
                method: 'get',
                mediaType: '',
                extensions: { openapiV3: {} },
                cookies: {},
                pathParameters: {},
                queryParameters: {},
                headers: {},
              },
            },
            {
              key: '6abb0086-ae73-405d-b72d-d9534bde0fbb',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 200,
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      done: { type: 'boolean' },
                      projectId: { type: ['null', 'string'] },
                    },
                    required: ['id', 'title', 'done'],
                  },
                },
              },
            },
            {
              key: 'ef3be3d0-949c-40a7-ac33-dbf229ea16c7',
              attributes: {
                label: '',
                type: 'http-request',
                host: 'localhost',
                port: 8080,
                protocol: 'http',
                path: '/todos',
                method: 'post',
                bodyRequired: true,
                body: {
                  additionalProperties: false,
                  type: 'object',
                  properties: { title: { type: 'string' } },
                  required: ['title'],
                },
                mediaType: 'application/json',
                extensions: { openapiV3: {} },
                queryParameters: {},
                cookies: {},
                pathParameters: {},
                headers: {},
              },
            },
            {
              key: '2c9a2158-eebe-4398-b1da-b10ecfa709c1',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 201,
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    done: { type: 'boolean' },
                    projectId: { type: ['null', 'string'] },
                  },
                  required: ['id', 'title', 'done'],
                },
              },
            },
            {
              key: '90fdfaf9-5ea3-4249-83aa-0a009f3512bc',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 400,
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                },
              },
            },
            {
              key: '074a4dfa-ff69-4af5-b9a8-eba416d9186c',
              attributes: {
                label: '',
                type: 'http-request',
                host: 'localhost',
                port: 8080,
                protocol: 'http',
                path: '/todos/{id}',
                method: 'get',
                mediaType: '',
                extensions: { openapiV3: {} },
                cookies: {},
                pathParameters: {
                  id: {
                    required: true,
                    schema: { type: 'string' },
                    style: { style: 'simple', explode: false },
                  },
                },
                queryParameters: {},
                headers: {},
              },
            },
            {
              key: 'a235e5e0-58b0-483d-b439-ca32f35a404d',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 200,
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    done: { type: 'boolean' },
                    projectId: { type: ['null', 'string'] },
                  },
                  required: ['id', 'title', 'done'],
                },
              },
            },
            {
              key: 'b5fb6ed7-f121-4c6f-8646-783a38c0aa4e',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 404,
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                },
              },
            },
            {
              key: '5faa233d-acc1-485e-a910-f1084a5bc7c8',
              attributes: {
                label: '',
                type: 'http-request',
                host: 'localhost',
                port: 8080,
                protocol: 'http',
                path: '/todos/{id}',
                method: 'put',
                bodyRequired: false,
                body: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    done: { type: 'boolean' },
                    projectId: { type: 'string' },
                  },
                  additionalProperties: false,
                },
                mediaType: 'application/json',
                extensions: { openapiV3: {} },
                queryParameters: {},
                cookies: {},
                pathParameters: {
                  id: {
                    required: true,
                    schema: { type: 'string' },
                    style: { style: 'simple', explode: false },
                  },
                },
                headers: {},
              },
            },
            {
              key: 'c13d99ee-39b6-49f7-9679-a58372c288a6',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 200,
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    done: { type: 'boolean' },
                    projectId: { type: ['null', 'string'] },
                  },
                  required: ['id', 'title', 'done'],
                },
              },
            },
            {
              key: 'fee801d0-f004-49a0-9bcf-6a0c21e13bca',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 400,
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                },
              },
            },
            {
              key: 'a1390ef4-9e58-47ff-bfa5-3213870e2b23',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 404,
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                },
              },
            },
            {
              key: 'd64088ba-45fc-49a0-b4f5-bfe1e591d2e7',
              attributes: {
                label: '',
                type: 'http-request',
                host: 'localhost',
                port: 8080,
                protocol: 'http',
                path: '/todos/{id}',
                method: 'delete',
                mediaType: '',
                extensions: { openapiV3: {} },
                cookies: {},
                pathParameters: {
                  id: {
                    required: true,
                    schema: { type: 'string' },
                    style: { style: 'simple', explode: false },
                  },
                },
                queryParameters: {},
                headers: {},
              },
            },
            {
              key: '376073c4-17b0-42d0-a9d5-401186ac4393',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: '',
                statusCode: 204,
              },
            },
            {
              key: 'e82f1215-cc61-4e27-af90-c34ee831e37b',
              attributes: {
                label: '',
                type: 'http-response',
                description: 'Default Response',
                headers: {},
                mediaType: 'application/json',
                statusCode: 404,
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                },
              },
            },
          ],
          edges: [
            {
              key: 'geid_187_0',
              source: 'ff4df09d-9c26-4903-81c7-3643b384b7c4',
              target: 'bf76d1f8-fae9-464d-8025-2eb4ab88ec8a',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_1',
              source: 'f52fba20-4e21-460b-b0bb-10c14aa448a2',
              target: '17edfa3a-598e-40ba-9e8d-872f6cd38176',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_2',
              source: 'f52fba20-4e21-460b-b0bb-10c14aa448a2',
              target: 'af62f2b5-0197-44ae-80a0-d381efee468a',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_3',
              source: '64338bca-eda4-4dcb-b822-ad3c7703cd78',
              target: 'eb0097f0-1252-4d7a-b5f0-d4645a7d1270',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_4',
              source: '64338bca-eda4-4dcb-b822-ad3c7703cd78',
              target: 'eb813cce-5e95-4f7a-9ed8-a4523a3f93cf',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_5',
              source: 'a2e8d334-fc8e-4ab2-ba9e-0fe0de34b18f',
              target: '745b1b85-da18-4fc0-9382-0829ea0cd3e6',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_6',
              source: 'a2e8d334-fc8e-4ab2-ba9e-0fe0de34b18f',
              target: '0e5523c2-ad5c-476c-9335-1e522e56311d',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_7',
              source: '7a8a1884-c467-4e2b-8146-92c7f76b99f8',
              target: '55a5ca94-282a-40e6-9c36-67ec9915ccc4',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_8',
              source: '7a8a1884-c467-4e2b-8146-92c7f76b99f8',
              target: 'a1bd73ac-f4a2-40e8-9e10-ac5f5128fa3e',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_9',
              source: '0b856f44-865a-4781-9d82-1ce95089c30a',
              target: 'dfc47bcb-6d11-4c44-92a0-c11e6dd2d991',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_10',
              source: '6873b02b-73aa-4410-818a-53874d51d69a',
              target: '6abb0086-ae73-405d-b72d-d9534bde0fbb',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_11',
              source: 'ef3be3d0-949c-40a7-ac33-dbf229ea16c7',
              target: '2c9a2158-eebe-4398-b1da-b10ecfa709c1',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_12',
              source: 'ef3be3d0-949c-40a7-ac33-dbf229ea16c7',
              target: '90fdfaf9-5ea3-4249-83aa-0a009f3512bc',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_13',
              source: '074a4dfa-ff69-4af5-b9a8-eba416d9186c',
              target: 'a235e5e0-58b0-483d-b439-ca32f35a404d',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_14',
              source: '074a4dfa-ff69-4af5-b9a8-eba416d9186c',
              target: 'b5fb6ed7-f121-4c6f-8646-783a38c0aa4e',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_15',
              source: '5faa233d-acc1-485e-a910-f1084a5bc7c8',
              target: 'c13d99ee-39b6-49f7-9679-a58372c288a6',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_16',
              source: '5faa233d-acc1-485e-a910-f1084a5bc7c8',
              target: 'fee801d0-f004-49a0-9bcf-6a0c21e13bca',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_17',
              source: '5faa233d-acc1-485e-a910-f1084a5bc7c8',
              target: 'a1390ef4-9e58-47ff-bfa5-3213870e2b23',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_18',
              source: 'd64088ba-45fc-49a0-b4f5-bfe1e591d2e7',
              target: '376073c4-17b0-42d0-a9d5-401186ac4393',
              attributes: { label: '', type: 'http-transaction' },
            },
            {
              key: 'geid_187_19',
              source: 'd64088ba-45fc-49a0-b4f5-bfe1e591d2e7',
              target: 'e82f1215-cc61-4e27-af90-c34ee831e37b',
              attributes: { label: '', type: 'http-transaction' },
            },
          ],
        },
        'test',
      );

      const result = await generateTypesForThymianFormat(format);

      const dtsContent = generatedTypesToString(result.types);

      const project = new Project({
        skipAddingFilesFromTsConfig: true,
        compilerOptions: {
          strict: true,
        },
      });
      const sourceFile = project.createSourceFile('generated.d.ts', dtsContent);
      const diagnostics = sourceFile.getPreEmitDiagnostics();

      expect(
        diagnostics.length,
        'Generated source file should not emit any diagnostics',
      ).toBe(0);
    },
  );
});
