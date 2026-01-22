import { ThymianEmitter, ThymianFormat } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { generateSamplesForThymianFormat } from '../src/generation/generate-samples-for-thymian-format.js';
import { mergeTrees } from '../src/samples-structure/merge-tree.js';
import type { SamplesStructure } from '../src/samples-structure/samples-tree-structure.js';

const format = ThymianFormat.import(
  {
    options: { type: 'directed', multi: true, allowSelfLoops: true },
    attributes: { hash: '26eb158798c88461f8c4ce896742b1cb75316fb5' },
    nodes: [
      {
        key: 'b6b71a13dff23d1b9399e0b2007aeb1de027005b',
        attributes: {
          label: 'GET http://127.0.0.1:3000/',
          type: 'http-request',
          host: '127.0.0.1',
          port: 3000,
          protocol: 'http',
          path: '/',
          method: 'get',
          mediaType: '',
          extensions: { openapi: { operationId: 'AppController_getHello' } },
          cookies: {},
          pathParameters: {},
          queryParameters: {},
          headers: {},
        },
      },
      {
        key: 'a4fec83da85f8162c55fa431c7dc2b9c2737dd9e',
        attributes: {
          label: '200 OK',
          type: 'http-response',
          description: '',
          headers: {},
          mediaType: '',
          statusCode: 200,
        },
      },
      {
        key: 'ae0b383ed42b6d9f2ca1704899d22b64be8b7001',
        attributes: {
          label: 'POST http://127.0.0.1:3000/users - application/json',
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
          extensions: { openapi: { operationId: 'UsersController_create' } },
          queryParameters: {},
          cookies: {},
          pathParameters: {},
          headers: {},
        },
      },
      {
        key: 'ccb962840b8826eee493e45f1a3b58b2c7c3246b',
        attributes: {
          label: '201 CREATED - application/json',
          type: 'http-response',
          description: 'User was created.',
          headers: {},
          mediaType: 'application/json',
          statusCode: 201,
          schema: { type: 'object', properties: {} },
        },
      },
      {
        key: '83e8d238aa7d895b89a8dbd2ae24ef4c0a8bca32',
        attributes: {
          label: 'GET http://127.0.0.1:3000/users',
          type: 'http-request',
          host: '127.0.0.1',
          port: 3000,
          protocol: 'http',
          path: '/users',
          method: 'get',
          mediaType: '',
          extensions: { openapi: { operationId: 'UsersController_findAll' } },
          cookies: {},
          pathParameters: {},
          queryParameters: {},
          headers: {},
        },
      },
      {
        key: '042f307d882ca03719978624a0c291aff48e058b',
        attributes: {
          label: '200 OK',
          type: 'http-response',
          description: 'List of users',
          headers: {},
          mediaType: '',
          statusCode: 200,
        },
      },
      {
        key: 'bdd6c5bd97dbe7687b7c3319784e58e3dcd3de33',
        attributes: {
          label: 'GET http://127.0.0.1:3000/users/{id}',
          type: 'http-request',
          host: '127.0.0.1',
          port: 3000,
          protocol: 'http',
          path: '/users/{id}',
          method: 'get',
          mediaType: '',
          extensions: { openapi: { operationId: 'UsersController_findOne' } },
          cookies: {},
          pathParameters: {
            id: {
              required: true,
              schema: { type: 'number' },
              style: { style: 'simple', explode: false },
            },
          },
          queryParameters: {},
          headers: {},
        },
      },
      {
        key: '02e7f14595f9c38af606deb738e8287bb7b8b5ca',
        attributes: {
          label: '200 OK',
          type: 'http-response',
          description: 'User entity',
          headers: {},
          mediaType: '',
          statusCode: 200,
        },
      },
      {
        key: 'c986b70eee86d70c4faf4fe775d16900b60f346e',
        attributes: {
          label: 'PATCH http://127.0.0.1:3000/users/{id}',
          type: 'http-request',
          host: '127.0.0.1',
          port: 3000,
          protocol: 'http',
          path: '/users/{id}',
          method: 'patch',
          mediaType: '',
          extensions: { openapi: { operationId: 'UsersController_update' } },
          cookies: {},
          pathParameters: {
            id: {
              required: true,
              schema: { type: 'number' },
              style: { style: 'simple', explode: false },
            },
          },
          queryParameters: {},
          headers: {},
        },
      },
      {
        key: 'f5c5b38e39b44df430d9485ca45aaa16e74d01a5',
        attributes: {
          label: '200 OK',
          type: 'http-response',
          description: 'Updated user',
          headers: {},
          mediaType: '',
          statusCode: 200,
        },
      },
      {
        key: '12a1fba08e503cd58e25f56541098ec74967ef0a',
        attributes: {
          label: 'DELETE http://127.0.0.1:3000/users/{id}',
          type: 'http-request',
          host: '127.0.0.1',
          port: 3000,
          protocol: 'http',
          path: '/users/{id}',
          method: 'delete',
          mediaType: '',
          extensions: { openapi: { operationId: 'UsersController_remove' } },
          cookies: {},
          pathParameters: {
            id: {
              required: true,
              schema: { type: 'number' },
              style: { style: 'simple', explode: false },
            },
          },
          queryParameters: {},
          headers: {},
        },
      },
      {
        key: '95368a2188283002042c4d86a19a32b6984ba28f',
        attributes: {
          label: '200 OK',
          type: 'http-response',
          description: 'User deleted',
          headers: {},
          mediaType: '',
          statusCode: 200,
        },
      },
      {
        key: '69deca67581a3433b3ad3d4dd5a4d976915aa9ae',
        attributes: {
          label: 'POST http://127.0.0.1:3000/todos - application/json',
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
              description: { type: 'string', examples: ['Milk, Bread, Eggs'] },
            },
            required: ['title'],
          },
          mediaType: 'application/json',
          extensions: { openapi: { operationId: 'TodosController_create' } },
          queryParameters: {},
          cookies: {},
          pathParameters: {},
          headers: {},
        },
      },
      {
        key: 'a1e5f7813761e37d22e1136b58210696588a2b16',
        attributes: {
          label: '201 CREATED',
          type: 'http-response',
          description: 'Todo created',
          headers: {},
          mediaType: '',
          statusCode: 201,
        },
      },
      {
        key: '6e7dbddf94db23290bb504d2b575fc2dff1cca74',
        attributes: {
          label: 'GET http://127.0.0.1:3000/todos',
          type: 'http-request',
          host: '127.0.0.1',
          port: 3000,
          protocol: 'http',
          path: '/todos',
          method: 'get',
          mediaType: '',
          extensions: { openapi: { operationId: 'TodosController_findAll' } },
          cookies: {},
          pathParameters: {},
          queryParameters: {},
          headers: {},
        },
      },
      {
        key: 'b9b730b0b2a51897fa67c434c0ab0a91335e370f',
        attributes: {
          label: '200 OK',
          type: 'http-response',
          description: 'List of todos',
          headers: {},
          mediaType: '',
          statusCode: 200,
        },
      },
      {
        key: 'abb725fec5fc5e5bdeb15209189448ab75067379',
        attributes: {
          label:
            'POST http://127.0.0.1:3000/todos/{id}/participants - application/json',
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
                items: { type: 'string' },
                examples: [[1, 2]],
              },
            },
            required: ['userIds'],
          },
          mediaType: 'application/json',
          extensions: {
            openapi: { operationId: 'TodosController_addParticipants' },
          },
          queryParameters: {},
          cookies: {},
          pathParameters: {
            id: {
              required: true,
              schema: { type: 'number' },
              style: { style: 'simple', explode: false },
            },
          },
          headers: {},
        },
      },
      {
        key: '3fdc32d32f95594dcafa7c81be75d80ca967955e',
        attributes: {
          label: '200 OK',
          type: 'http-response',
          description: 'Participants added',
          headers: {},
          mediaType: '',
          statusCode: 200,
        },
      },
      {
        key: '0ee5ee75acb56f49002623100e7b699332fa078a',
        attributes: {
          label: 'GET http://127.0.0.1:3000/todos/{id}',
          type: 'http-request',
          host: '127.0.0.1',
          port: 3000,
          protocol: 'http',
          path: '/todos/{id}',
          method: 'get',
          mediaType: '',
          extensions: { openapi: { operationId: 'TodosController_get' } },
          cookies: {},
          pathParameters: {
            id: {
              required: true,
              schema: { type: 'number' },
              style: { style: 'simple', explode: false },
            },
          },
          queryParameters: {},
          headers: {},
        },
      },
      {
        key: '8aafd51044351bd4187d271ca07d05a8b5c8cbf6',
        attributes: {
          label: '200 OK',
          type: 'http-response',
          description: 'Todo found',
          headers: {},
          mediaType: '',
          statusCode: 200,
        },
      },
      {
        key: '601641929b92a42dd94027b7b37c7d372915e7a8',
        attributes: {
          label: 'PATCH http://127.0.0.1:3000/todos/{id}',
          type: 'http-request',
          host: '127.0.0.1',
          port: 3000,
          protocol: 'http',
          path: '/todos/{id}',
          method: 'patch',
          mediaType: '',
          extensions: { openapi: { operationId: 'TodosController_update' } },
          cookies: {},
          pathParameters: {
            id: {
              required: true,
              schema: { type: 'number' },
              style: { style: 'simple', explode: false },
            },
          },
          queryParameters: {},
          headers: {},
        },
      },
      {
        key: 'f0b36d5629ef7d9c2bf2633f84a6759753d09ef7',
        attributes: {
          label: '200 OK',
          type: 'http-response',
          description: 'Updated todo',
          headers: {},
          mediaType: '',
          statusCode: 200,
        },
      },
      {
        key: 'b692919e43c131ebfa208d7c6e49265ba32bda7c',
        attributes: {
          label: 'DELETE http://127.0.0.1:3000/todos/{id}',
          type: 'http-request',
          host: '127.0.0.1',
          port: 3000,
          protocol: 'http',
          path: '/todos/{id}',
          method: 'delete',
          mediaType: '',
          extensions: { openapi: { operationId: 'TodosController_remove' } },
          cookies: {},
          pathParameters: {
            id: {
              required: true,
              schema: { type: 'number' },
              style: { style: 'simple', explode: false },
            },
          },
          queryParameters: {},
          headers: {},
        },
      },
      {
        key: 'd6ca491430c9aed0cf576a000c698e89107e803f',
        attributes: {
          label: '200 OK',
          type: 'http-response',
          description: 'Todo deleted',
          headers: {},
          mediaType: '',
          statusCode: 200,
        },
      },
      {
        key: '216cfa2dece58f069c295e55d47759db81b7ddc1',
        attributes: {
          label:
            'POST http://127.0.0.1:3000/todos/{todoId}/tasks - application/json',
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
              title: { type: 'string', examples: ['Buy milk'] },
              description: { type: 'string', examples: ['Whole milk 3.5%'] },
            },
            required: ['title'],
          },
          mediaType: 'application/json',
          extensions: { openapi: { operationId: 'TasksController_create' } },
          queryParameters: {},
          cookies: {},
          pathParameters: {
            todoId: {
              required: true,
              schema: { type: 'number' },
              style: { style: 'simple', explode: false },
            },
          },
          headers: {},
        },
      },
      {
        key: '9063716425d3ba5d86925c9bdd19188bb6ff8a3d',
        attributes: {
          label: '201 CREATED',
          type: 'http-response',
          description: 'Task erstellt',
          headers: {},
          mediaType: '',
          statusCode: 201,
        },
      },
      {
        key: '9016f305bbc0e004c6b31aea6946b907e154c429',
        attributes: {
          label: 'GET http://127.0.0.1:3000/todos/{todoId}/tasks',
          type: 'http-request',
          host: '127.0.0.1',
          port: 3000,
          protocol: 'http',
          path: '/todos/{todoId}/tasks',
          method: 'get',
          mediaType: '',
          extensions: { openapi: { operationId: 'TasksController_findAll' } },
          cookies: {},
          pathParameters: {
            todoId: {
              required: true,
              schema: { type: 'number' },
              style: { style: 'simple', explode: false },
            },
          },
          queryParameters: {},
          headers: {},
        },
      },
      {
        key: '650ddcf477fe39e35a4c02342e7d6fa48fec5b74',
        attributes: {
          label: '200 OK',
          type: 'http-response',
          description: 'Liste von Tasks',
          headers: {},
          mediaType: '',
          statusCode: 200,
        },
      },
      {
        key: '7cca55219148fad629a135651e922577c6c67737',
        attributes: {
          label: 'GET http://127.0.0.1:3000/todos/{todoId}/tasks/{id}',
          type: 'http-request',
          host: '127.0.0.1',
          port: 3000,
          protocol: 'http',
          path: '/todos/{todoId}/tasks/{id}',
          method: 'get',
          mediaType: '',
          extensions: { openapi: { operationId: 'TasksController_findOne' } },
          cookies: {},
          pathParameters: {
            todoId: {
              required: true,
              schema: { type: 'number' },
              style: { style: 'simple', explode: false },
            },
            id: {
              required: true,
              schema: { type: 'number' },
              style: { style: 'simple', explode: false },
            },
          },
          queryParameters: {},
          headers: {},
        },
      },
      {
        key: '37d71336ac2e7bbde991cd38a53c83739cf6e29c',
        attributes: {
          label: '200 OK',
          type: 'http-response',
          description: 'Task gefunden',
          headers: {},
          mediaType: '',
          statusCode: 200,
        },
      },
      {
        key: '369cfc31f07c9952b827931105f811a412a0bfc2',
        attributes: {
          label: 'PATCH http://127.0.0.1:3000/todos/{todoId}/tasks/{id}',
          type: 'http-request',
          host: '127.0.0.1',
          port: 3000,
          protocol: 'http',
          path: '/todos/{todoId}/tasks/{id}',
          method: 'patch',
          mediaType: '',
          extensions: { openapi: { operationId: 'TasksController_update' } },
          cookies: {},
          pathParameters: {
            todoId: {
              required: true,
              schema: { type: 'number' },
              style: { style: 'simple', explode: false },
            },
            id: {
              required: true,
              schema: { type: 'number' },
              style: { style: 'simple', explode: false },
            },
          },
          queryParameters: {},
          headers: {},
        },
      },
      {
        key: 'f630e92fcc876ec1b7c52b228af9a24d43a9c480',
        attributes: {
          label: '200 OK',
          type: 'http-response',
          description: 'Task aktualisiert',
          headers: {},
          mediaType: '',
          statusCode: 200,
        },
      },
      {
        key: '5d838af2fb446614e0dc632faa6d43c60ec8e70b',
        attributes: {
          label: 'DELETE http://127.0.0.1:3000/todos/{todoId}/tasks/{id}',
          type: 'http-request',
          host: '127.0.0.1',
          port: 3000,
          protocol: 'http',
          path: '/todos/{todoId}/tasks/{id}',
          method: 'delete',
          mediaType: '',
          extensions: { openapi: { operationId: 'TasksController_remove' } },
          cookies: {},
          pathParameters: {
            todoId: {
              required: true,
              schema: { type: 'number' },
              style: { style: 'simple', explode: false },
            },
            id: {
              required: true,
              schema: { type: 'number' },
              style: { style: 'simple', explode: false },
            },
          },
          queryParameters: {},
          headers: {},
        },
      },
      {
        key: 'c03ea4f7ca8dfcc0083e7103daf5f3d1bdc9b416',
        attributes: {
          label: '200 OK',
          type: 'http-response',
          description: 'Task gelöscht',
          headers: {},
          mediaType: '',
          statusCode: 200,
        },
      },
    ],
    edges: [
      {
        key: '8b5e6ec08540220cee8e12ff64fc5bfcf9442a0c',
        source: 'b6b71a13dff23d1b9399e0b2007aeb1de027005b',
        target: 'a4fec83da85f8162c55fa431c7dc2b9c2737dd9e',
        attributes: {
          label: 'GET http://127.0.0.1:3000/ → 200 OK',
          type: 'http-transaction',
        },
      },
      {
        key: '321ddd17f7f0f485ece0703b120ce57e097cbaef',
        source: 'ae0b383ed42b6d9f2ca1704899d22b64be8b7001',
        target: 'ccb962840b8826eee493e45f1a3b58b2c7c3246b',
        attributes: {
          label:
            'POST http://127.0.0.1:3000/users - application/json → 201 CREATED - application/json',
          type: 'http-transaction',
        },
      },
      {
        key: '1d5b9c4f5f4c5145ee7af17befca8bd85a6f5533',
        source: '83e8d238aa7d895b89a8dbd2ae24ef4c0a8bca32',
        target: '042f307d882ca03719978624a0c291aff48e058b',
        attributes: {
          label: 'GET http://127.0.0.1:3000/users → 200 OK',
          type: 'http-transaction',
        },
      },
      {
        key: '0e33bba585ffe274bc6a92454b5f724287ab9857',
        source: 'bdd6c5bd97dbe7687b7c3319784e58e3dcd3de33',
        target: '02e7f14595f9c38af606deb738e8287bb7b8b5ca',
        attributes: {
          label: 'GET http://127.0.0.1:3000/users/{id} → 200 OK',
          type: 'http-transaction',
        },
      },
      {
        key: '89632851dca4b181b6b528eeeb06bc381faf873f',
        source: 'c986b70eee86d70c4faf4fe775d16900b60f346e',
        target: 'f5c5b38e39b44df430d9485ca45aaa16e74d01a5',
        attributes: {
          label: 'PATCH http://127.0.0.1:3000/users/{id} → 200 OK',
          type: 'http-transaction',
        },
      },
      {
        key: '751871c35374c5376884778f10a80f8fd3d627cf',
        source: '12a1fba08e503cd58e25f56541098ec74967ef0a',
        target: '95368a2188283002042c4d86a19a32b6984ba28f',
        attributes: {
          label: 'DELETE http://127.0.0.1:3000/users/{id} → 200 OK',
          type: 'http-transaction',
        },
      },
      {
        key: '151c2dc81f110a79d7b477cf4162aa2eb0e0739d',
        source: '69deca67581a3433b3ad3d4dd5a4d976915aa9ae',
        target: 'a1e5f7813761e37d22e1136b58210696588a2b16',
        attributes: {
          label:
            'POST http://127.0.0.1:3000/todos - application/json → 201 CREATED',
          type: 'http-transaction',
        },
      },
      {
        key: 'acb5b69885816ea14243a4f7d848438e5432cf02',
        source: '6e7dbddf94db23290bb504d2b575fc2dff1cca74',
        target: 'b9b730b0b2a51897fa67c434c0ab0a91335e370f',
        attributes: {
          label: 'GET http://127.0.0.1:3000/todos → 200 OK',
          type: 'http-transaction',
        },
      },
      {
        key: '105fd0413175e7155ba089072ba9f07aa047de03',
        source: 'abb725fec5fc5e5bdeb15209189448ab75067379',
        target: '3fdc32d32f95594dcafa7c81be75d80ca967955e',
        attributes: {
          label:
            'POST http://127.0.0.1:3000/todos/{id}/participants - application/json → 200 OK',
          type: 'http-transaction',
        },
      },
      {
        key: '0ed9438dccc5c8a319149cfb24f2c7695a9f30ed',
        source: '0ee5ee75acb56f49002623100e7b699332fa078a',
        target: '8aafd51044351bd4187d271ca07d05a8b5c8cbf6',
        attributes: {
          label: 'GET http://127.0.0.1:3000/todos/{id} → 200 OK',
          type: 'http-transaction',
        },
      },
      {
        key: '363783b3f122787da03fce8fb37cab4f6696fb3b',
        source: '601641929b92a42dd94027b7b37c7d372915e7a8',
        target: 'f0b36d5629ef7d9c2bf2633f84a6759753d09ef7',
        attributes: {
          label: 'PATCH http://127.0.0.1:3000/todos/{id} → 200 OK',
          type: 'http-transaction',
        },
      },
      {
        key: 'd4bb3aef82e4a8b8b23240438c048f5a026be05f',
        source: 'b692919e43c131ebfa208d7c6e49265ba32bda7c',
        target: 'd6ca491430c9aed0cf576a000c698e89107e803f',
        attributes: {
          label: 'DELETE http://127.0.0.1:3000/todos/{id} → 200 OK',
          type: 'http-transaction',
        },
      },
      {
        key: '8530e9322e355a7834aef2f1118e5296e1bdb732',
        source: '216cfa2dece58f069c295e55d47759db81b7ddc1',
        target: '9063716425d3ba5d86925c9bdd19188bb6ff8a3d',
        attributes: {
          label:
            'POST http://127.0.0.1:3000/todos/{todoId}/tasks - application/json → 201 CREATED',
          type: 'http-transaction',
        },
      },
      {
        key: '1c990caab338a7f598c61e46b1f8d7574b2cd7fd',
        source: '9016f305bbc0e004c6b31aea6946b907e154c429',
        target: '650ddcf477fe39e35a4c02342e7d6fa48fec5b74',
        attributes: {
          label: 'GET http://127.0.0.1:3000/todos/{todoId}/tasks → 200 OK',
          type: 'http-transaction',
        },
      },
      {
        key: '6900ff05a44e5c54b38097ea1f8ad15a1373328a',
        source: '7cca55219148fad629a135651e922577c6c67737',
        target: '37d71336ac2e7bbde991cd38a53c83739cf6e29c',
        attributes: {
          label: 'GET http://127.0.0.1:3000/todos/{todoId}/tasks/{id} → 200 OK',
          type: 'http-transaction',
        },
      },
      {
        key: '5f61c12ddba75e69b486a291a972d75a1af093ee',
        source: '369cfc31f07c9952b827931105f811a412a0bfc2',
        target: 'f630e92fcc876ec1b7c52b228af9a24d43a9c480',
        attributes: {
          label:
            'PATCH http://127.0.0.1:3000/todos/{todoId}/tasks/{id} → 200 OK',
          type: 'http-transaction',
        },
      },
      {
        key: 'ce78ba966f4e89c5fafc1e790a6556f57cf89d3b',
        source: '5d838af2fb446614e0dc632faa6d43c60ec8e70b',
        target: 'c03ea4f7ca8dfcc0083e7103daf5f3d1bdc9b416',
        attributes: {
          label:
            'DELETE http://127.0.0.1:3000/todos/{todoId}/tasks/{id} → 200 OK',
          type: 'http-transaction',
        },
      },
    ],
  },
  'source',
);

describe('mergeTrees', () => {
  const mockTree = (
    version: string,
    timestamp: number,
    hooks = {
      afterEachResponse: [],
      beforeEachRequest: [],
      authorize: [],
    },
    children = [],
  ): SamplesStructure => ({
    type: 'root',
    meta: { version, timestamp },
    hooks,
    children,
  });

  it('should merge two trees with the same version', () => {
    const treeA = mockTree('1.0.0', 100, {
      afterEachResponse: [],
      beforeEachRequest: [],
      authorize: [],
    });
    const treeB = mockTree('1.0.0', 200);

    const result = mergeTrees(treeA, treeB);

    expect(result.meta.version).toBe('1.0.0');
    expect(result.meta.timestamp).toBe(200);
  });

  it('should throw an error if versions are different', () => {
    const treeA = mockTree('1.0.0', 100);
    const treeB = mockTree('2.0.0', 200);

    expect(() => mergeTrees(treeA, treeB)).toThrow(
      'Cannot merge SamplesTrees with different versions: 1.0.0 vs 2.0.0',
    );
  });

  it('should keep the latest timestamp from both trees', () => {
    const treeA = mockTree('1.0.0', 300);
    const treeB = mockTree('1.0.0', 500);

    const result = mergeTrees(treeA, treeB);

    expect(result.meta.timestamp).toBe(500);
  });

  it('work', () => {
    const treeA = mockTree('1.0.0', 300);
    const treeB = mockTree('1.0.0', 400);

    treeA.children.push({
      type: 'host',
      value: 'localhost',
      children: [
        {
          type: 'port',
          value: '8080',
          children: [
            {
              type: 'method',
              value: 'GET',
              children: [
                {
                  type: 'statusCode',
                  value: '200',
                  children: [
                    {
                      type: 'samples',
                      meta: {
                        sourceTransaction: 'abc123',
                        samplingStrategy: { type: 'random' },
                      },
                      children: [
                        {
                          type: 'requests',
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    treeB.children.push({
      type: 'host',
      value: 'localhost',
      children: [
        {
          type: 'port',
          value: '8080',
          children: [
            {
              type: 'method',
              value: 'GET',
              children: [
                {
                  type: 'statusCode',
                  value: '200',
                  children: [
                    {
                      type: 'samples',
                      children: [
                        {
                          type: 'requests',
                          children: [],
                          value: [
                            {
                              path: '/',
                              method: 'get',
                              headers: {},
                              authorize: false,
                              query: {},
                              cookies: {},
                              pathParameters: {},
                              origin: 'http://localhost:8080',
                            },
                          ],
                        },
                      ],
                      meta: {
                        sourceTransaction: 'abc123',
                        samplingStrategy: { type: 'random' },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const result = mergeTrees(treeA, treeB);

    expect(result).toMatchObject({
      type: 'root',
      meta: { version: '1.0.0', timestamp: 400 },
      children: [
        {
          type: 'host',
          value: 'localhost',
          children: [
            {
              type: 'port',
              value: '8080',
              children: [
                {
                  type: 'method',
                  value: 'GET',
                  children: [
                    {
                      type: 'statusCode',
                      value: '200',
                      children: [
                        {
                          type: 'samples',
                          meta: {
                            sourceTransaction: 'abc123',
                            samplingStrategy: { type: 'random' },
                          },
                          children: [
                            {
                              type: 'requests',
                              children: [],
                              value: [
                                {
                                  path: '/',
                                  method: 'get',
                                  headers: {},
                                  authorize: false,
                                  query: {},
                                  cookies: {},
                                  pathParameters: {},
                                  origin: 'http://localhost:8080',
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });
});
