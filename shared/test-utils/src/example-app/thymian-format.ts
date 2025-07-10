import { ThymianFormat } from '@thymian/core';

export const exampleAppFormat = ThymianFormat.import({
  options: { type: 'directed', multi: true, allowSelfLoops: true },
  attributes: {},
  nodes: [
    {
      key: '03b832ae-fcae-4a85-b525-6e0d1894378f',
      attributes: {
        type: 'security-scheme',
        scheme: 'basic',
        extensions: { openapiV3: { schemeName: 'basicAuth' } },
      },
    },
    {
      key: '8bcf62de-a5b8-4207-9b16-376e122b4b55',
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
      key: '10e6d84d-383c-496c-ad3d-166ccab4291a',
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
      key: 'd01353ee-6be5-4c67-8002-253dced79260',
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
      key: '76340b1f-18a7-4e88-810d-d839b404a4f4',
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
      key: '406a8f94-64b4-4de2-bec4-44e68f767ebe',
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
      key: '818c45c1-409f-4136-a8d0-eb6ef13dd763',
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
      key: '5b6ac7b3-b425-4d3d-868b-bd239292b76e',
      attributes: {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/video-streaming/valid',
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
      key: 'eafbd56e-c37f-4ccb-9fcb-1a7164c9e064',
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
      key: '1bbbb8c6-6794-4654-a177-b91cc712e3a9',
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
      key: '7d635706-686b-4f38-a712-b05a9772f7c1',
      attributes: {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/video-streaming/invalid',
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
      key: '50edc045-86b7-465b-a4ee-050bb904b4c9',
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
      key: '3e564cb7-8ff6-48aa-b0b4-f536aa18797e',
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
      key: '7e957f44-1c7e-4e36-abb0-c629165f23b7',
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
      key: '72973150-562d-44a1-81e7-ecddecc50a82',
      attributes: {
        type: 'http-response',
        description: 'reset content',
        headers: {},
        mediaType: '',
        statusCode: 205,
      },
    },
    {
      key: '431db9d9-bb33-4b65-b603-234b86c8dc73',
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
      key: 'c8a43dfd-49e2-49b8-a518-925c7268dab9',
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
      key: 'geid_108_0',
      source: '8bcf62de-a5b8-4207-9b16-376e122b4b55',
      target: '03b832ae-fcae-4a85-b525-6e0d1894378f',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_108_1',
      source: '8bcf62de-a5b8-4207-9b16-376e122b4b55',
      target: '10e6d84d-383c-496c-ad3d-166ccab4291a',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_108_2',
      source: 'd01353ee-6be5-4c67-8002-253dced79260',
      target: '03b832ae-fcae-4a85-b525-6e0d1894378f',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_108_3',
      source: 'd01353ee-6be5-4c67-8002-253dced79260',
      target: '76340b1f-18a7-4e88-810d-d839b404a4f4',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_108_4',
      source: '406a8f94-64b4-4de2-bec4-44e68f767ebe',
      target: '03b832ae-fcae-4a85-b525-6e0d1894378f',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_108_5',
      source: '406a8f94-64b4-4de2-bec4-44e68f767ebe',
      target: '818c45c1-409f-4136-a8d0-eb6ef13dd763',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_108_6',
      source: '5b6ac7b3-b425-4d3d-868b-bd239292b76e',
      target: '03b832ae-fcae-4a85-b525-6e0d1894378f',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_108_7',
      source: '5b6ac7b3-b425-4d3d-868b-bd239292b76e',
      target: 'eafbd56e-c37f-4ccb-9fcb-1a7164c9e064',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_108_8',
      source: '5b6ac7b3-b425-4d3d-868b-bd239292b76e',
      target: '1bbbb8c6-6794-4654-a177-b91cc712e3a9',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_108_9',
      source: '7d635706-686b-4f38-a712-b05a9772f7c1',
      target: '03b832ae-fcae-4a85-b525-6e0d1894378f',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_108_10',
      source: '7d635706-686b-4f38-a712-b05a9772f7c1',
      target: '50edc045-86b7-465b-a4ee-050bb904b4c9',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_108_11',
      source: '7d635706-686b-4f38-a712-b05a9772f7c1',
      target: '3e564cb7-8ff6-48aa-b0b4-f536aa18797e',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_108_12',
      source: '7e957f44-1c7e-4e36-abb0-c629165f23b7',
      target: '03b832ae-fcae-4a85-b525-6e0d1894378f',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_108_13',
      source: '7e957f44-1c7e-4e36-abb0-c629165f23b7',
      target: '72973150-562d-44a1-81e7-ecddecc50a82',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_108_14',
      source: '431db9d9-bb33-4b65-b603-234b86c8dc73',
      target: '03b832ae-fcae-4a85-b525-6e0d1894378f',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_108_15',
      source: '431db9d9-bb33-4b65-b603-234b86c8dc73',
      target: 'c8a43dfd-49e2-49b8-a518-925c7268dab9',
      attributes: { type: 'http-transaction' },
    },
  ],
});
