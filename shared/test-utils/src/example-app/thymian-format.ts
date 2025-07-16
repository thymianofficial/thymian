import { ThymianFormat } from '@thymian/core';

export const exampleAppFormat = ThymianFormat.import({
  options: { type: 'directed', multi: true, allowSelfLoops: true },
  attributes: {},
  nodes: [
    {
      key: 'f013fb94-09e9-4187-bdf6-3614c62473da',
      attributes: {
        type: 'security-scheme',
        scheme: 'basic',
        extensions: { openapiV3: { schemeName: 'basicAuth' } },
      },
    },
    {
      key: '31b32af4-5e10-4aff-bc5e-202023aad943',
      attributes: {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/todos/',
        method: 'get',
        mediaType: '',
        extensions: { openapiV3: {} },
        cookies: {},
        pathParameters: {},
        queryParameters: {
          title: {
            required: true,
            schema: { type: 'string' },
            style: { style: 'form', explode: true },
          },
        },
        headers: {},
      },
    },
    {
      key: '4df9cc4a-b2e5-4610-acd5-00fe83252906',
      attributes: {
        type: 'http-response',
        description: 'Default Response',
        headers: {
          etag: {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
        },
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
              text: { type: 'string' },
            },
          },
        },
      },
    },
    {
      key: 'a88725bc-a8d6-4cac-b166-34b4786dfcef',
      attributes: {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/todos/',
        method: 'post',
        bodyRequired: true,
        body: {
          type: 'object',
          required: ['title', 'text'],
          additionalProperties: false,
          properties: { text: { type: 'string' }, title: { type: 'string' } },
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
      key: 'd4aad8b6-c7bf-4834-83ec-e082a2880e51',
      attributes: {
        type: 'http-response',
        description: 'Default Response',
        headers: {
          location: {
            required: true,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
        },
        mediaType: 'application/json',
        statusCode: 201,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            text: { type: 'string' },
          },
        },
      },
    },
    {
      key: '6361b82b-fd52-45a3-8fa5-81f9f6dc47bb',
      attributes: {
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
            schema: { type: 'string', examples: [1] },
            style: { style: 'simple', explode: false },
          },
        },
        queryParameters: {},
        headers: {},
      },
    },
    {
      key: '5d03a99c-9f98-44e1-9043-23a598e5aeea',
      attributes: {
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
            text: { type: 'string' },
          },
        },
      },
    },
    {
      key: '6e04167a-f7e4-4610-943f-4fd675e4effb',
      attributes: {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/range-requests/valid',
        method: 'get',
        mediaType: '',
        extensions: { openapiV3: {} },
        cookies: {},
        pathParameters: {},
        queryParameters: {},
        headers: {
          range: {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
        },
      },
    },
    {
      key: '7b4416bb-98a8-4bda-9f7a-7471615717a1',
      attributes: {
        type: 'http-response',
        description: 'Default Response',
        headers: {
          range: {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
          etag: {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
          'cache-control': {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
        },
        mediaType: 'application/octet-stream',
        statusCode: 200,
      },
    },
    {
      key: '08c2a4c0-d304-4c68-bc8f-07f07bf222d6',
      attributes: {
        type: 'http-response',
        description: 'Default Response',
        headers: {
          range: {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
          etag: {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
          'cache-control': {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
          'content-range': {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
          'accept-ranges': {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
        },
        mediaType: 'application/octet-stream',
        statusCode: 206,
      },
    },
    {
      key: '6a7f1053-48ad-48c0-8a6e-c24f45a18267',
      attributes: {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/range-requests/invalid',
        method: 'get',
        mediaType: '',
        extensions: { openapiV3: {} },
        cookies: {},
        pathParameters: {},
        queryParameters: {},
        headers: {
          range: {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
        },
      },
    },
    {
      key: '4533b83d-2082-4dc4-9429-6ec7776436d7',
      attributes: {
        type: 'http-response',
        description: 'Default Response',
        headers: {
          range: {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
          etag: {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
        },
        mediaType: 'application/octet-stream',
        statusCode: 200,
      },
    },
    {
      key: 'ef9ee326-3e79-4da3-bd4e-2c00829dee0b',
      attributes: {
        type: 'http-response',
        description: 'Default Response',
        headers: {
          range: {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
        },
        mediaType: 'application/octet-stream',
        statusCode: 206,
      },
    },
    {
      key: 'ebc8d515-cfa8-4dd6-ac44-997c1d6c432d',
      attributes: {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/range-requests/valid-if-range',
        method: 'get',
        mediaType: '',
        extensions: { openapiV3: {} },
        cookies: {},
        pathParameters: {},
        queryParameters: {},
        headers: {
          range: {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
          'if-range': {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
        },
      },
    },
    {
      key: '90038c7e-2432-4c52-b0ce-b1c09f0bde7f',
      attributes: {
        type: 'http-response',
        description: 'Default Response',
        headers: {
          range: {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
          'if-range': {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
          etag: {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
        },
        mediaType: 'application/octet-stream',
        statusCode: 200,
      },
    },
    {
      key: 'a348b773-5e50-43c5-a555-b24120b9fa59',
      attributes: {
        type: 'http-response',
        description: 'Default Response',
        headers: {
          range: {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
          'if-range': {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
          etag: {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
        },
        mediaType: 'application/octet-stream',
        statusCode: 206,
      },
    },
    {
      key: 'cba32bbd-1666-4e39-9113-c1d5f8ac4137',
      attributes: {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/reset-content/valid',
        method: 'post',
        bodyRequired: false,
        body: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' } },
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
      key: 'baf079d6-273b-4c5b-ba84-ecce44715c15',
      attributes: {
        type: 'http-response',
        description: 'reset content',
        headers: {},
        mediaType: '',
        statusCode: 205,
      },
    },
    {
      key: 'dd8bba02-31d7-4959-b73e-4c1246a20931',
      attributes: {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/reset-content/invalid',
        method: 'post',
        bodyRequired: false,
        body: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' } },
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
      key: '9452a104-c650-4de3-9c2d-3295223eca7f',
      attributes: {
        type: 'http-response',
        description: 'reset content',
        headers: {},
        mediaType: 'application/json',
        statusCode: 205,
        schema: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' } },
        },
      },
    },
  ],
  edges: [
    {
      key: 'geid_44_0',
      source: '31b32af4-5e10-4aff-bc5e-202023aad943',
      target: 'f013fb94-09e9-4187-bdf6-3614c62473da',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_44_1',
      source: '31b32af4-5e10-4aff-bc5e-202023aad943',
      target: '4df9cc4a-b2e5-4610-acd5-00fe83252906',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_44_2',
      source: 'a88725bc-a8d6-4cac-b166-34b4786dfcef',
      target: 'f013fb94-09e9-4187-bdf6-3614c62473da',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_44_3',
      source: 'a88725bc-a8d6-4cac-b166-34b4786dfcef',
      target: 'd4aad8b6-c7bf-4834-83ec-e082a2880e51',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_44_4',
      source: '6361b82b-fd52-45a3-8fa5-81f9f6dc47bb',
      target: 'f013fb94-09e9-4187-bdf6-3614c62473da',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_44_5',
      source: '6361b82b-fd52-45a3-8fa5-81f9f6dc47bb',
      target: '5d03a99c-9f98-44e1-9043-23a598e5aeea',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_44_6',
      source: '6e04167a-f7e4-4610-943f-4fd675e4effb',
      target: 'f013fb94-09e9-4187-bdf6-3614c62473da',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_44_7',
      source: '6e04167a-f7e4-4610-943f-4fd675e4effb',
      target: '7b4416bb-98a8-4bda-9f7a-7471615717a1',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_44_8',
      source: '6e04167a-f7e4-4610-943f-4fd675e4effb',
      target: '08c2a4c0-d304-4c68-bc8f-07f07bf222d6',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_44_9',
      source: '6a7f1053-48ad-48c0-8a6e-c24f45a18267',
      target: 'f013fb94-09e9-4187-bdf6-3614c62473da',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_44_10',
      source: '6a7f1053-48ad-48c0-8a6e-c24f45a18267',
      target: '4533b83d-2082-4dc4-9429-6ec7776436d7',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_44_11',
      source: '6a7f1053-48ad-48c0-8a6e-c24f45a18267',
      target: 'ef9ee326-3e79-4da3-bd4e-2c00829dee0b',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_44_12',
      source: 'ebc8d515-cfa8-4dd6-ac44-997c1d6c432d',
      target: 'f013fb94-09e9-4187-bdf6-3614c62473da',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_44_13',
      source: 'ebc8d515-cfa8-4dd6-ac44-997c1d6c432d',
      target: '90038c7e-2432-4c52-b0ce-b1c09f0bde7f',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_44_14',
      source: 'ebc8d515-cfa8-4dd6-ac44-997c1d6c432d',
      target: 'a348b773-5e50-43c5-a555-b24120b9fa59',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_44_15',
      source: 'cba32bbd-1666-4e39-9113-c1d5f8ac4137',
      target: 'f013fb94-09e9-4187-bdf6-3614c62473da',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_44_16',
      source: 'cba32bbd-1666-4e39-9113-c1d5f8ac4137',
      target: 'baf079d6-273b-4c5b-ba84-ecce44715c15',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_44_17',
      source: 'dd8bba02-31d7-4959-b73e-4c1246a20931',
      target: 'f013fb94-09e9-4187-bdf6-3614c62473da',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_44_18',
      source: 'dd8bba02-31d7-4959-b73e-4c1246a20931',
      target: '9452a104-c650-4de3-9c2d-3295223eca7f',
      attributes: { type: 'http-transaction' },
    },
  ],
});
