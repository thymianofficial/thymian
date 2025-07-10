import { ThymianFormat } from '@thymian/core';

export const exampleAppFormat = ThymianFormat.import({
  options: {
    type: 'directed',
    multi: true,
    allowSelfLoops: true,
  },
  attributes: {},
  nodes: [
    {
      key: 'd43fd526-b15c-4c26-b451-8d26c749d495',
      attributes: {
        type: 'security-scheme',
        scheme: 'basic',
        extensions: {
          openapiV3: {
            schemeName: 'basicAuth',
          },
        },
      },
    },
    {
      key: 'f9b4d1d9-8f0e-4f73-aa44-88c1b7a666db',
      attributes: {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/todos/',
        method: 'get',
        mediaType: '',
        extensions: {
          openapiV3: {},
        },
        cookies: {},
        pathParameters: {},
        queryParameters: {
          title: {
            required: true,
            schema: {
              type: 'string',
            },
            style: {
              style: 'form',
              explode: true,
            },
          },
        },
        headers: {},
      },
    },
    {
      key: '5af227ab-5f00-4955-ab15-ccffc71cbffc',
      attributes: {
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
              id: {
                type: 'string',
              },
              title: {
                type: 'string',
              },
              text: {
                type: 'string',
              },
            },
          },
        },
      },
    },
    {
      key: '968909dc-d573-4c59-93e5-93aa803da8b2',
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
          properties: {
            text: {
              type: 'string',
            },
            title: {
              type: 'string',
            },
          },
        },
        mediaType: 'application/json',
        extensions: {
          openapiV3: {},
        },
        queryParameters: {},
        cookies: {},
        pathParameters: {},
        headers: {},
      },
    },
    {
      key: '8c307397-f741-4ece-9f04-9f33b6ff9284',
      attributes: {
        type: 'http-response',
        description: 'Default Response',
        headers: {
          location: {
            required: true,
            schema: {
              type: 'string',
            },
            style: {
              style: 'simple',
              explode: false,
            },
          },
        },
        mediaType: 'application/json',
        statusCode: 201,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
            },
            title: {
              type: 'string',
            },
            text: {
              type: 'string',
            },
          },
        },
      },
    },
    {
      key: '4d6f018d-038a-4e9a-83ac-b68798937855',
      attributes: {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/todos/{id}',
        method: 'get',
        mediaType: '',
        extensions: {
          openapiV3: {},
        },
        cookies: {},
        pathParameters: {
          id: {
            required: true,
            schema: {
              type: 'string',
              examples: [1],
            },
            style: {
              style: 'simple',
              explode: false,
            },
          },
        },
        queryParameters: {},
        headers: {},
      },
    },
    {
      key: '1310293a-fc8d-48a2-a497-394601103c00',
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
            id: {
              type: 'string',
            },
            title: {
              type: 'string',
            },
            text: {
              type: 'string',
            },
          },
        },
      },
    },
    {
      key: '6e8b1508-f265-4ac1-895f-f197d791dba7',
      attributes: {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/video-streaming/valid',
        method: 'get',
        mediaType: '',
        extensions: {
          openapiV3: {},
        },
        cookies: {},
        pathParameters: {},
        queryParameters: {},
        headers: {
          range: {
            required: false,
            schema: {
              type: 'string',
            },
            style: {
              style: 'simple',
              explode: false,
            },
          },
        },
      },
    },
    {
      key: 'bd23ad03-7624-42bb-b421-56f54e9406eb',
      attributes: {
        type: 'http-response',
        description: 'Default Response',
        headers: {
          range: {
            required: false,
            schema: {
              type: 'string',
            },
            style: {
              style: 'simple',
              explode: false,
            },
          },
        },
        mediaType: 'application/octet-stream',
        statusCode: 200,
        schema: {},
      },
    },
    {
      key: '1154f889-985e-48cd-9857-376e8dff2c82',
      attributes: {
        type: 'http-response',
        description: 'Default Response',
        headers: {
          range: {
            required: false,
            schema: {
              type: 'string',
            },
            style: {
              style: 'simple',
              explode: false,
            },
          },
        },
        mediaType: 'application/octet-stream',
        statusCode: 206,
        schema: {},
      },
    },
    {
      key: '571a676c-2468-4710-b2a2-0c5cd249dd3b',
      attributes: {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/video-streaming/invalid',
        method: 'get',
        mediaType: '',
        extensions: {
          openapiV3: {},
        },
        cookies: {},
        pathParameters: {},
        queryParameters: {},
        headers: {
          range: {
            required: false,
            schema: {
              type: 'string',
            },
            style: {
              style: 'simple',
              explode: false,
            },
          },
        },
      },
    },
    {
      key: 'a71fb62e-f993-4684-862d-99654c372bf3',
      attributes: {
        type: 'http-response',
        description: 'Default Response',
        headers: {
          range: {
            required: false,
            schema: {
              type: 'string',
            },
            style: {
              style: 'simple',
              explode: false,
            },
          },
        },
        mediaType: 'application/octet-stream',
        statusCode: 200,
        schema: {},
      },
    },
    {
      key: 'f41018e9-0721-4e18-ae0b-acd84409560e',
      attributes: {
        type: 'http-response',
        description: 'Default Response',
        headers: {
          range: {
            required: false,
            schema: {
              type: 'string',
            },
            style: {
              style: 'simple',
              explode: false,
            },
          },
        },
        mediaType: 'application/octet-stream',
        statusCode: 206,
        schema: {},
      },
    },
  ],
  edges: [
    {
      key: 'geid_22_0',
      source: 'f9b4d1d9-8f0e-4f73-aa44-88c1b7a666db',
      target: 'd43fd526-b15c-4c26-b451-8d26c749d495',
      attributes: {
        type: 'is-secured',
      },
    },
    {
      key: 'geid_22_1',
      source: 'f9b4d1d9-8f0e-4f73-aa44-88c1b7a666db',
      target: '5af227ab-5f00-4955-ab15-ccffc71cbffc',
      attributes: {
        type: 'http-transaction',
      },
    },
    {
      key: 'geid_22_2',
      source: '968909dc-d573-4c59-93e5-93aa803da8b2',
      target: 'd43fd526-b15c-4c26-b451-8d26c749d495',
      attributes: {
        type: 'is-secured',
      },
    },
    {
      key: 'geid_22_3',
      source: '968909dc-d573-4c59-93e5-93aa803da8b2',
      target: '8c307397-f741-4ece-9f04-9f33b6ff9284',
      attributes: {
        type: 'http-transaction',
      },
    },
    {
      key: 'geid_22_4',
      source: '4d6f018d-038a-4e9a-83ac-b68798937855',
      target: 'd43fd526-b15c-4c26-b451-8d26c749d495',
      attributes: {
        type: 'is-secured',
      },
    },
    {
      key: 'geid_22_5',
      source: '4d6f018d-038a-4e9a-83ac-b68798937855',
      target: '1310293a-fc8d-48a2-a497-394601103c00',
      attributes: {
        type: 'http-transaction',
      },
    },
    {
      key: 'geid_22_6',
      source: '6e8b1508-f265-4ac1-895f-f197d791dba7',
      target: 'bd23ad03-7624-42bb-b421-56f54e9406eb',
      attributes: {
        type: 'http-transaction',
      },
    },
    {
      key: 'geid_22_7',
      source: '6e8b1508-f265-4ac1-895f-f197d791dba7',
      target: '1154f889-985e-48cd-9857-376e8dff2c82',
      attributes: {
        type: 'http-transaction',
      },
    },
    {
      key: 'geid_22_8',
      source: '571a676c-2468-4710-b2a2-0c5cd249dd3b',
      target: 'a71fb62e-f993-4684-862d-99654c372bf3',
      attributes: {
        type: 'http-transaction',
      },
    },
    {
      key: 'geid_22_9',
      source: '571a676c-2468-4710-b2a2-0c5cd249dd3b',
      target: 'f41018e9-0721-4e18-ae0b-acd84409560e',
      attributes: {
        type: 'http-transaction',
      },
    },
  ],
});
