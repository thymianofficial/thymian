import { ThymianFormat } from '@thymian/core';

export const exampleAppFormat = ThymianFormat.import({
  options: { type: 'directed', multi: true, allowSelfLoops: true },
  attributes: {},
  nodes: [
    {
      key: 'f6047871-7c0f-4b08-ab57-95f6c69850ef',
      attributes: {
        type: 'security-scheme',
        scheme: 'basic',
        extensions: { openapiV3: { schemeName: 'basicAuth' } },
      },
    },
    {
      key: '059f8ba7-68fe-4c7f-9c03-8b23f3e09bde',
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
            schema: { type: 'string', examples: ['title'] },
            style: { style: 'form', explode: true },
          },
        },
        headers: {},
      },
    },
    {
      key: '1d1b8b15-ef0e-4641-9ce3-3bdb6f692a15',
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
      key: 'cfa82d14-ec58-4311-a75b-f5a74beb7e7b',
      attributes: {
        type: 'http-response',
        description: 'not authorized',
        headers: {},
        mediaType: '',
        statusCode: 401,
      },
    },
    {
      key: '115ed36f-35d4-4775-bf92-e81bf622c0cc',
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
      key: 'e9f055a6-946b-4598-bd46-9a49a63dcb5f',
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
      key: '8130e527-fa58-4bb4-89e5-3642753ef451',
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
      key: 'b61df69b-abd4-418a-a1e5-b6c50b5cd136',
      attributes: {
        type: 'http-response',
        description: 'Default Response',
        headers: {
          'cache-control': {
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
      key: '260f960b-4724-4c18-940b-ca324db9cccd',
      attributes: {
        type: 'http-response',
        description: '',
        headers: {
          etag: {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
          'content-range': {
            required: false,
            schema: { type: 'string' },
            style: { style: 'simple', explode: false },
          },
        },
        mediaType: '',
        statusCode: 304,
      },
    },
    {
      key: '53782e1d-0327-44bc-b066-efb3da40da76',
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
      key: 'a0169df1-abb0-4ea5-88f2-f40ac27bbcc9',
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
      key: '8822c6aa-be9f-4067-bc44-8b56b706c8b4',
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
      key: '94a4176b-7f6a-42cc-bdcd-356f8d14218d',
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
      key: '5a4ecbc4-df77-4066-8a42-557d33a15d07',
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
      key: '949edfc3-01b8-4c77-af5a-debd31382e15',
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
      key: 'f488f237-b3fe-4652-9a73-4d6555ad3cc7',
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
      key: '6b9dce0e-853d-4403-b368-8942df1053d8',
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
      key: '67c2623e-bf8e-482d-bd13-72cfa0401cc5',
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
      key: '9f6d3ee3-2b6c-4b9d-9fd6-2dba6c6e9dcd',
      attributes: {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/range-requests/invalid-if-range',
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
      key: '596f0759-3762-486f-b14d-a01c17456d44',
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
      key: 'f0163517-4c60-44db-b4eb-b1ce1376c284',
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
      key: '84e7dfc3-b0bc-4a0c-bb80-f6d6c45c2f89',
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
      key: '95ef284d-fbff-447a-afd0-a272cd90b9b1',
      attributes: {
        type: 'http-response',
        description: 'reset content',
        headers: {},
        mediaType: '',
        statusCode: 205,
      },
    },
    {
      key: '0d527bbc-5c7b-45d5-b5c0-a9b7c616dc20',
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
      key: '36c2ba69-6d79-4359-8b36-00936c015f37',
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
      key: 'geid_232_0',
      source: '059f8ba7-68fe-4c7f-9c03-8b23f3e09bde',
      target: 'f6047871-7c0f-4b08-ab57-95f6c69850ef',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_232_1',
      source: '059f8ba7-68fe-4c7f-9c03-8b23f3e09bde',
      target: '1d1b8b15-ef0e-4641-9ce3-3bdb6f692a15',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_232_2',
      source: '059f8ba7-68fe-4c7f-9c03-8b23f3e09bde',
      target: 'cfa82d14-ec58-4311-a75b-f5a74beb7e7b',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_232_3',
      source: '115ed36f-35d4-4775-bf92-e81bf622c0cc',
      target: 'f6047871-7c0f-4b08-ab57-95f6c69850ef',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_232_4',
      source: '115ed36f-35d4-4775-bf92-e81bf622c0cc',
      target: 'e9f055a6-946b-4598-bd46-9a49a63dcb5f',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_232_5',
      source: '8130e527-fa58-4bb4-89e5-3642753ef451',
      target: 'f6047871-7c0f-4b08-ab57-95f6c69850ef',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_232_6',
      source: '8130e527-fa58-4bb4-89e5-3642753ef451',
      target: 'b61df69b-abd4-418a-a1e5-b6c50b5cd136',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_232_7',
      source: '8130e527-fa58-4bb4-89e5-3642753ef451',
      target: '260f960b-4724-4c18-940b-ca324db9cccd',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_232_8',
      source: '53782e1d-0327-44bc-b066-efb3da40da76',
      target: 'f6047871-7c0f-4b08-ab57-95f6c69850ef',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_232_9',
      source: '53782e1d-0327-44bc-b066-efb3da40da76',
      target: 'a0169df1-abb0-4ea5-88f2-f40ac27bbcc9',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_232_10',
      source: '53782e1d-0327-44bc-b066-efb3da40da76',
      target: '8822c6aa-be9f-4067-bc44-8b56b706c8b4',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_232_11',
      source: '94a4176b-7f6a-42cc-bdcd-356f8d14218d',
      target: 'f6047871-7c0f-4b08-ab57-95f6c69850ef',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_232_12',
      source: '94a4176b-7f6a-42cc-bdcd-356f8d14218d',
      target: '5a4ecbc4-df77-4066-8a42-557d33a15d07',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_232_13',
      source: '94a4176b-7f6a-42cc-bdcd-356f8d14218d',
      target: '949edfc3-01b8-4c77-af5a-debd31382e15',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_232_14',
      source: 'f488f237-b3fe-4652-9a73-4d6555ad3cc7',
      target: 'f6047871-7c0f-4b08-ab57-95f6c69850ef',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_232_15',
      source: 'f488f237-b3fe-4652-9a73-4d6555ad3cc7',
      target: '6b9dce0e-853d-4403-b368-8942df1053d8',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_232_16',
      source: 'f488f237-b3fe-4652-9a73-4d6555ad3cc7',
      target: '67c2623e-bf8e-482d-bd13-72cfa0401cc5',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_232_17',
      source: '9f6d3ee3-2b6c-4b9d-9fd6-2dba6c6e9dcd',
      target: 'f6047871-7c0f-4b08-ab57-95f6c69850ef',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_232_18',
      source: '9f6d3ee3-2b6c-4b9d-9fd6-2dba6c6e9dcd',
      target: '596f0759-3762-486f-b14d-a01c17456d44',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_232_19',
      source: '9f6d3ee3-2b6c-4b9d-9fd6-2dba6c6e9dcd',
      target: 'f0163517-4c60-44db-b4eb-b1ce1376c284',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_232_20',
      source: '84e7dfc3-b0bc-4a0c-bb80-f6d6c45c2f89',
      target: 'f6047871-7c0f-4b08-ab57-95f6c69850ef',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_232_21',
      source: '84e7dfc3-b0bc-4a0c-bb80-f6d6c45c2f89',
      target: '95ef284d-fbff-447a-afd0-a272cd90b9b1',
      attributes: { type: 'http-transaction' },
    },
    {
      key: 'geid_232_22',
      source: '0d527bbc-5c7b-45d5-b5c0-a9b7c616dc20',
      target: 'f6047871-7c0f-4b08-ab57-95f6c69850ef',
      attributes: { type: 'is-secured' },
    },
    {
      key: 'geid_232_23',
      source: '0d527bbc-5c7b-45d5-b5c0-a9b7c616dc20',
      target: '36c2ba69-6d79-4359-8b36-00936c015f37',
      attributes: { type: 'http-transaction' },
    },
  ],
});
