import { rm } from 'node:fs/promises';

import { ThymianEmitter, ThymianFormat } from '@thymian/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateSamplesForThymianFormat } from '../src/generation/generate-samples-for-thymian-format.js';
import { generateTypesForThymianFormat } from '../src/hooks/generate-request-types.js';
import { RequestSampler } from '../src/request-sampler.js';
import { writeSamplesToDir } from '../src/samples-structure/write-samples-to-dir.js';
import { createTempDir } from './utils.js';

const format = ThymianFormat.import({
  options: {
    type: 'directed',
    multi: true,
    allowSelfLoops: true,
  },
  attributes: {
    hash: '1f3a38bba5b0dd393bb8c12426f83b150c1ac1c6',
  },
  nodes: [
    {
      key: 'ac5cf657c6d887415d3f192c0e8489a01f01dfd1',
      attributes: {
        label: 'GET http://127.0.0.1:3000/',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/',
        method: 'get',
        mediaType: '',
        extensions: {
          openapi: {
            operationId: 'AppController_getHello',
          },
        },
        cookies: {},
        pathParameters: {},
        queryParameters: {},
        headers: {},
      },
    },
    {
      key: 'c1362b2fcd036df384350bd6aa0902f1b8d0185b',
      attributes: {
        label: '200 OK',
        type: 'http-response',
        description: '',
        headers: {},
        mediaType: '',
        statusCode: 200,
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 9,
            column: 5,
            offset: 101,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: 'e3eb1270b360f8666fbbe26ff28c3c58487f8a7b',
      attributes: {
        label: 'POST http://127.0.0.1:3000/users - application/json',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/users',
        method: 'post',
        bodyRequired: true,
        body: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'user name',
              examples: ['alice'],
            },
            password: {
              type: 'string',
              description: 'password in plain test',
              examples: ['secret'],
            },
          },
          required: ['name', 'password'],
        },
        mediaType: 'application/json',
        extensions: {
          openapi: {
            operationId: 'UsersController_create',
          },
        },
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 18,
            column: 5,
            offset: 267,
          },
        },
        queryParameters: {},
        cookies: {},
        pathParameters: {},
        headers: {},
      },
    },
    {
      key: 'ce2c774b88fa4d3baae036322eee0660a695afef',
      attributes: {
        label: '201 CREATED - application/json',
        type: 'http-response',
        description: 'User was created.',
        headers: {},
        mediaType: 'application/json',
        statusCode: 201,
        schema: {
          type: 'object',
          properties: {},
        },
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 18,
            column: 5,
            offset: 267,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '4709e02687d997ee95e551f62255fce98bb67f5d',
      attributes: {
        label: 'GET http://127.0.0.1:3000/users',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/users',
        method: 'get',
        mediaType: '',
        extensions: {
          openapi: {
            operationId: 'UsersController_findAll',
          },
        },
        cookies: {},
        pathParameters: {},
        queryParameters: {},
        headers: {},
      },
    },
    {
      key: '1f420215d72dfe0081968237f26110f96be629ac',
      attributes: {
        label: '200 OK',
        type: 'http-response',
        description: 'List of users',
        headers: {},
        mediaType: '',
        statusCode: 200,
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 37,
            column: 5,
            offset: 761,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '0d0ab6bb6cd75bb14936a526a3dbeadcb1b446cf',
      attributes: {
        label: 'GET http://127.0.0.1:3000/users/{id}',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/users/{id}',
        method: 'get',
        mediaType: '',
        extensions: {
          openapi: {
            operationId: 'UsersController_findOne',
          },
        },
        cookies: {},
        pathParameters: {
          id: {
            required: true,
            schema: {
              type: 'number',
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
      key: '56487f91a1ece4a01e333ab4f86b5e8f0d891649',
      attributes: {
        label: '200 OK',
        type: 'http-response',
        description: 'User entity',
        headers: {},
        mediaType: '',
        statusCode: 200,
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 46,
            column: 5,
            offset: 960,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '5c87cbc33489003b2a9cbd82aefefe87f9195f12',
      attributes: {
        label: 'PATCH http://127.0.0.1:3000/users/{id}',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/users/{id}',
        method: 'patch',
        mediaType: '',
        extensions: {
          openapi: {
            operationId: 'UsersController_update',
          },
        },
        cookies: {},
        pathParameters: {
          id: {
            required: true,
            schema: {
              type: 'number',
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
      key: '4966bbde38a39cab7442179a358d028d85991c31',
      attributes: {
        label: '200 OK',
        type: 'http-response',
        description: 'Updated user',
        headers: {},
        mediaType: '',
        statusCode: 200,
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 59,
            column: 5,
            offset: 1249,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: 'bc1448b9477d2aec1705d5734b7a5a4a0dc5e7aa',
      attributes: {
        label: 'DELETE http://127.0.0.1:3000/users/{id}',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/users/{id}',
        method: 'delete',
        mediaType: '',
        extensions: {
          openapi: {
            operationId: 'UsersController_remove',
          },
        },
        cookies: {},
        pathParameters: {
          id: {
            required: true,
            schema: {
              type: 'number',
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
      key: '500d4df3a71a3d8c266b6eb9214cd5f23519f94a',
      attributes: {
        label: '200 OK',
        type: 'http-response',
        description: 'User deleted',
        headers: {},
        mediaType: '',
        statusCode: 200,
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 72,
            column: 5,
            offset: 1537,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: 'ec16fe9ef26ba95e9d2545369cf242fc8806a2dc',
      attributes: {
        label: 'POST http://127.0.0.1:3000/todos - application/json',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/todos',
        method: 'post',
        bodyRequired: true,
        body: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Title of the todo',
              examples: ['Shopping'],
            },
            description: {
              type: 'string',
              examples: ['Milk, Bread, Eggs'],
            },
          },
          required: ['title'],
        },
        mediaType: 'application/json',
        extensions: {
          openapi: {
            operationId: 'TodosController_create',
          },
        },
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 86,
            column: 5,
            offset: 1836,
          },
        },
        queryParameters: {},
        cookies: {},
        pathParameters: {},
        headers: {},
      },
    },
    {
      key: '66402aed67b03f38773e2ec56f278f903fc39466',
      attributes: {
        label: '201 CREATED',
        type: 'http-response',
        description: 'Todo created',
        headers: {},
        mediaType: '',
        statusCode: 201,
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 86,
            column: 5,
            offset: 1836,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: 'c5329e9297c84a023ecca07279d709c00227a960',
      attributes: {
        label: 'GET http://127.0.0.1:3000/todos',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/todos',
        method: 'get',
        mediaType: '',
        extensions: {
          openapi: {
            operationId: 'TodosController_findAll',
          },
        },
        cookies: {},
        pathParameters: {},
        queryParameters: {},
        headers: {},
      },
    },
    {
      key: 'de85c0ca2a3542b355aa3abd444db54d734e5911',
      attributes: {
        label: '200 OK',
        type: 'http-response',
        description: 'List of todos',
        headers: {},
        mediaType: '',
        statusCode: 200,
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 103,
            column: 5,
            offset: 2262,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: 'cc9393008646e21ba98b3036637232ad1800babf',
      attributes: {
        label:
          'POST http://127.0.0.1:3000/todos/{id}/participants - application/json',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/todos/{id}/participants',
        method: 'post',
        bodyRequired: true,
        body: {
          type: 'object',
          properties: {
            userIds: {
              description: 'IDs of users to add to the todo',
              type: 'array',
              items: {
                type: 'string',
              },
              examples: [[1, 2]],
            },
          },
          required: ['userIds'],
        },
        mediaType: 'application/json',
        extensions: {
          openapi: {
            operationId: 'TodosController_addParticipants',
          },
        },
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 113,
            column: 5,
            offset: 2510,
          },
        },
        queryParameters: {},
        cookies: {},
        pathParameters: {
          id: {
            required: true,
            schema: {
              type: 'number',
            },
            style: {
              style: 'simple',
              explode: false,
            },
          },
        },
        headers: {},
      },
    },
    {
      key: '9c1d14eed116776e9153dc6713351f8468afd414',
      attributes: {
        label: '200 OK',
        type: 'http-response',
        description: 'Participants added',
        headers: {},
        mediaType: '',
        statusCode: 200,
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 113,
            column: 5,
            offset: 2510,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '5f3ce4bcc2d04608612ec6b59ca6c16661fcef31',
      attributes: {
        label: 'GET http://127.0.0.1:3000/todos/{id}',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/todos/{id}',
        method: 'get',
        mediaType: '',
        extensions: {
          openapi: {
            operationId: 'TodosController_get',
          },
        },
        cookies: {},
        pathParameters: {
          id: {
            required: true,
            schema: {
              type: 'number',
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
      key: '89a567234bb0ecc06e8a262fa0948ddcc8eb6de5',
      attributes: {
        label: '200 OK',
        type: 'http-response',
        description: 'Todo found',
        headers: {},
        mediaType: '',
        statusCode: 200,
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 134,
            column: 5,
            offset: 3047,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '7bfda9f815296a37f3a49aa7c28cf0d480b3e38b',
      attributes: {
        label: 'PATCH http://127.0.0.1:3000/todos/{id}',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/todos/{id}',
        method: 'patch',
        mediaType: '',
        extensions: {
          openapi: {
            operationId: 'TodosController_update',
          },
        },
        cookies: {},
        pathParameters: {
          id: {
            required: true,
            schema: {
              type: 'number',
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
      key: '2a66b45bc9cca02fa49db9152233c93710e77225',
      attributes: {
        label: '200 OK',
        type: 'http-response',
        description: 'Updated todo',
        headers: {},
        mediaType: '',
        statusCode: 200,
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 148,
            column: 5,
            offset: 3391,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '0f9fd959272d9af258bbc78f14f25c1a26276471',
      attributes: {
        label: 'DELETE http://127.0.0.1:3000/todos/{id}',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/todos/{id}',
        method: 'delete',
        mediaType: '',
        extensions: {
          openapi: {
            operationId: 'TodosController_remove',
          },
        },
        cookies: {},
        pathParameters: {
          id: {
            required: true,
            schema: {
              type: 'number',
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
      key: 'fa91b0a414390386e7c0c362428713a18518b5c1',
      attributes: {
        label: '200 OK',
        type: 'http-response',
        description: 'Todo deleted',
        headers: {},
        mediaType: '',
        statusCode: 200,
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 162,
            column: 5,
            offset: 3717,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '27f766d6497e5486de5986b576cf0080a6c99d1f',
      attributes: {
        label:
          'POST http://127.0.0.1:3000/todos/{todoId}/tasks - application/json',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/todos/{todoId}/tasks',
        method: 'post',
        bodyRequired: true,
        body: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              examples: ['Buy milk'],
            },
            description: {
              type: 'string',
              examples: ['Whole milk 3.5%'],
            },
          },
          required: ['title'],
        },
        mediaType: 'application/json',
        extensions: {
          openapi: {
            operationId: 'TasksController_create',
          },
        },
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 177,
            column: 5,
            offset: 4069,
          },
        },
        queryParameters: {},
        cookies: {},
        pathParameters: {
          todoId: {
            required: true,
            schema: {
              type: 'number',
            },
            style: {
              style: 'simple',
              explode: false,
            },
          },
        },
        headers: {},
      },
    },
    {
      key: 'b71f4099e94c4ef063eeca3183516f2d2dc84991',
      attributes: {
        label: '201 CREATED',
        type: 'http-response',
        description: 'Task erstellt',
        headers: {},
        mediaType: '',
        statusCode: 201,
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 177,
            column: 5,
            offset: 4069,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '91396c367637e34f215d590ee52dd701a4ce2746',
      attributes: {
        label: 'GET http://127.0.0.1:3000/todos/{todoId}/tasks',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/todos/{todoId}/tasks',
        method: 'get',
        mediaType: '',
        extensions: {
          openapi: {
            operationId: 'TasksController_findAll',
          },
        },
        cookies: {},
        pathParameters: {
          todoId: {
            required: true,
            schema: {
              type: 'number',
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
      key: '0d11c8369e050f5fa3985718f4b7ea0a18d78be5',
      attributes: {
        label: '200 OK',
        type: 'http-response',
        description: 'Liste von Tasks',
        headers: {},
        mediaType: '',
        statusCode: 200,
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 199,
            column: 5,
            offset: 4617,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '9719110a0ee43f3563c7c6596f009df700222066',
      attributes: {
        label: 'GET http://127.0.0.1:3000/todos/{todoId}/tasks/{id}',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/todos/{todoId}/tasks/{id}',
        method: 'get',
        mediaType: '',
        extensions: {
          openapi: {
            operationId: 'TasksController_findOne',
          },
        },
        cookies: {},
        pathParameters: {
          todoId: {
            required: true,
            schema: {
              type: 'number',
            },
            style: {
              style: 'simple',
              explode: false,
            },
          },
          id: {
            required: true,
            schema: {
              type: 'number',
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
      key: 'd13ce73caddba5d61497ca64783aa7ff52a5b774',
      attributes: {
        label: '200 OK',
        type: 'http-response',
        description: 'Task gefunden',
        headers: {},
        mediaType: '',
        statusCode: 200,
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 214,
            column: 5,
            offset: 5000,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '18233d2f196de8d8a5c813784e15590fc1d05898',
      attributes: {
        label: 'PATCH http://127.0.0.1:3000/todos/{todoId}/tasks/{id}',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/todos/{todoId}/tasks/{id}',
        method: 'patch',
        mediaType: '',
        extensions: {
          openapi: {
            operationId: 'TasksController_update',
          },
        },
        cookies: {},
        pathParameters: {
          todoId: {
            required: true,
            schema: {
              type: 'number',
            },
            style: {
              style: 'simple',
              explode: false,
            },
          },
          id: {
            required: true,
            schema: {
              type: 'number',
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
      key: '08cbacc43ceb86d310c375d35123b850b03501df',
      attributes: {
        label: '200 OK',
        type: 'http-response',
        description: 'Task aktualisiert',
        headers: {},
        mediaType: '',
        statusCode: 200,
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 233,
            column: 5,
            offset: 5455,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: 'c1936df45eb1a80d0cf59b04008c680f86a0d303',
      attributes: {
        label: 'DELETE http://127.0.0.1:3000/todos/{todoId}/tasks/{id}',
        sourceName: 'Todos',
        type: 'http-request',
        host: '127.0.0.1',
        port: 3000,
        protocol: 'http',
        path: '/todos/{todoId}/tasks/{id}',
        method: 'delete',
        mediaType: '',
        extensions: {
          openapi: {
            operationId: 'TasksController_remove',
          },
        },
        cookies: {},
        pathParameters: {
          todoId: {
            required: true,
            schema: {
              type: 'number',
            },
            style: {
              style: 'simple',
              explode: false,
            },
          },
          id: {
            required: true,
            schema: {
              type: 'number',
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
      key: 'a017ac7b55f3d0ae3140462b4973a44c8366c483',
      attributes: {
        label: '200 OK',
        type: 'http-response',
        description: 'Task gelöscht',
        headers: {},
        mediaType: '',
        statusCode: 200,
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 252,
            column: 5,
            offset: 5903,
          },
        },
        sourceName: 'Todos',
      },
    },
  ],
  edges: [
    {
      key: '9a0f65a38c6ebc96ed69508b12c34af2e385fdff',
      source: 'ac5cf657c6d887415d3f192c0e8489a01f01dfd1',
      target: 'c1362b2fcd036df384350bd6aa0902f1b8d0185b',
      attributes: {
        label: 'GET http://127.0.0.1:3000/ → 200 OK',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 9,
            column: 5,
            offset: 101,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: 'd7b89c72c24c30244ebdb656c1c1f35d935fb486',
      source: 'e3eb1270b360f8666fbbe26ff28c3c58487f8a7b',
      target: 'ce2c774b88fa4d3baae036322eee0660a695afef',
      attributes: {
        label:
          'POST http://127.0.0.1:3000/users - application/json → 201 CREATED - application/json',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 18,
            column: 5,
            offset: 267,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '5a25003ea0954de99b31f8e96d5fb46d0e6e9936',
      source: '4709e02687d997ee95e551f62255fce98bb67f5d',
      target: '1f420215d72dfe0081968237f26110f96be629ac',
      attributes: {
        label: 'GET http://127.0.0.1:3000/users → 200 OK',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 37,
            column: 5,
            offset: 761,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: 'bb6d3447e90e10dcce9335d1b3882b8abecacd3a',
      source: '0d0ab6bb6cd75bb14936a526a3dbeadcb1b446cf',
      target: '56487f91a1ece4a01e333ab4f86b5e8f0d891649',
      attributes: {
        label: 'GET http://127.0.0.1:3000/users/{id} → 200 OK',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 46,
            column: 5,
            offset: 960,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '808a0586bda6e1b16a5345955035867c4dd88199',
      source: '5c87cbc33489003b2a9cbd82aefefe87f9195f12',
      target: '4966bbde38a39cab7442179a358d028d85991c31',
      attributes: {
        label: 'PATCH http://127.0.0.1:3000/users/{id} → 200 OK',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 59,
            column: 5,
            offset: 1249,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '1ddfc53bb8debfc8216b6fa8c613048bd199fcab',
      source: 'bc1448b9477d2aec1705d5734b7a5a4a0dc5e7aa',
      target: '500d4df3a71a3d8c266b6eb9214cd5f23519f94a',
      attributes: {
        label: 'DELETE http://127.0.0.1:3000/users/{id} → 200 OK',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 72,
            column: 5,
            offset: 1537,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: 'b105e13be30d8a4c14eee2270eea9e4c82ebb006',
      source: 'ec16fe9ef26ba95e9d2545369cf242fc8806a2dc',
      target: '66402aed67b03f38773e2ec56f278f903fc39466',
      attributes: {
        label:
          'POST http://127.0.0.1:3000/todos - application/json → 201 CREATED',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 86,
            column: 5,
            offset: 1836,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '807c5f5ce37aef7feb2ed0ed0c88fb06023093d8',
      source: 'c5329e9297c84a023ecca07279d709c00227a960',
      target: 'de85c0ca2a3542b355aa3abd444db54d734e5911',
      attributes: {
        label: 'GET http://127.0.0.1:3000/todos → 200 OK',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 103,
            column: 5,
            offset: 2262,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: 'c3200e0e42cd31d10026a921ccf2a12a4bb793e5',
      source: 'cc9393008646e21ba98b3036637232ad1800babf',
      target: '9c1d14eed116776e9153dc6713351f8468afd414',
      attributes: {
        label:
          'POST http://127.0.0.1:3000/todos/{id}/participants - application/json → 200 OK',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 113,
            column: 5,
            offset: 2510,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '56dd3e24415d169b1a3f7ffc040fd66a4d485389',
      source: '5f3ce4bcc2d04608612ec6b59ca6c16661fcef31',
      target: '89a567234bb0ecc06e8a262fa0948ddcc8eb6de5',
      attributes: {
        label: 'GET http://127.0.0.1:3000/todos/{id} → 200 OK',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 134,
            column: 5,
            offset: 3047,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: 'b03c29f2f55c2b2c75c705773f0144b31585019a',
      source: '7bfda9f815296a37f3a49aa7c28cf0d480b3e38b',
      target: '2a66b45bc9cca02fa49db9152233c93710e77225',
      attributes: {
        label: 'PATCH http://127.0.0.1:3000/todos/{id} → 200 OK',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 148,
            column: 5,
            offset: 3391,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '207e420e65b43f86b47d6215aa94d93ce889857d',
      source: '0f9fd959272d9af258bbc78f14f25c1a26276471',
      target: 'fa91b0a414390386e7c0c362428713a18518b5c1',
      attributes: {
        label: 'DELETE http://127.0.0.1:3000/todos/{id} → 200 OK',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 162,
            column: 5,
            offset: 3717,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '6c9cbe12d5c4d19acf6ab06f4e51ac0be9d22e42',
      source: '27f766d6497e5486de5986b576cf0080a6c99d1f',
      target: 'b71f4099e94c4ef063eeca3183516f2d2dc84991',
      attributes: {
        label:
          'POST http://127.0.0.1:3000/todos/{todoId}/tasks - application/json → 201 CREATED',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 177,
            column: 5,
            offset: 4069,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '3583038b873b745cac50ac7f5c3a05adb4c9de49',
      source: '91396c367637e34f215d590ee52dd701a4ce2746',
      target: '0d11c8369e050f5fa3985718f4b7ea0a18d78be5',
      attributes: {
        label: 'GET http://127.0.0.1:3000/todos/{todoId}/tasks → 200 OK',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 199,
            column: 5,
            offset: 4617,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: 'fabb297219172f61e72958fc753fd4f597b6f1ed',
      source: '9719110a0ee43f3563c7c6596f009df700222066',
      target: 'd13ce73caddba5d61497ca64783aa7ff52a5b774',
      attributes: {
        label: 'GET http://127.0.0.1:3000/todos/{todoId}/tasks/{id} → 200 OK',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 214,
            column: 5,
            offset: 5000,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '1bb421f87f4bf199ccfd47ed8adfef035986a927',
      source: '18233d2f196de8d8a5c813784e15590fc1d05898',
      target: '08cbacc43ceb86d310c375d35123b850b03501df',
      attributes: {
        label: 'PATCH http://127.0.0.1:3000/todos/{todoId}/tasks/{id} → 200 OK',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 233,
            column: 5,
            offset: 5455,
          },
        },
        sourceName: 'Todos',
      },
    },
    {
      key: '0f06f0215ae4831a758ec87b05be754325dc5cdd',
      source: 'c1936df45eb1a80d0cf59b04008c680f86a0d303',
      target: 'a017ac7b55f3d0ae3140462b4973a44c8366c483',
      attributes: {
        label:
          'DELETE http://127.0.0.1:3000/todos/{todoId}/tasks/{id} → 200 OK',
        type: 'http-transaction',
        sourceLocation: {
          path: '/Users/matthias/Developer/thymian-demo/openapi.yaml',
          position: {
            line: 252,
            column: 5,
            offset: 5903,
          },
        },
        sourceName: 'Todos',
      },
    },
  ],
});

describe('generateSamplesForThymianFormat', () => {
  let tempDir!: string;

  beforeEach(async () => {
    tempDir = await createTempDir('generateSamplesForThymianFormat');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should work', async () => {
    const samples = await generateSamplesForThymianFormat(
      format,
      new ThymianEmitter(),
    );

    const generated = await generateTypesForThymianFormat(format);

    await writeSamplesToDir(samples, generated.keyToTransactionId, {
      path: tempDir,
    });

    const sampler = new RequestSampler(tempDir);

    await sampler.init();

    for (const transaction of format.getThymianHttpTransactions()) {
      const sample = sampler.sampleForTransaction(transaction.transactionId);
      expect(sample).toBeDefined();
    }
  });
});
