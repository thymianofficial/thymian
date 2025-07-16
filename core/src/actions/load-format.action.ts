import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { SerializedThymianFormat } from '../format/index.js';
import type { Action } from './action.js';

export type LoadFormatAction = Action<void, SerializedThymianFormat>;

// TODO: schema is not 100% correct (but 99%)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
export const loadFormatActionSchema: JSONSchemaType<SerializedThymianFormat> = {
  type: 'object',
  additionalProperties: false,
  required: ['options', 'attributes', 'nodes', 'edges'],
  properties: {
    options: {
      type: 'object',
      nullable: false,
    },
    attributes: {
      type: 'object',
      nullable: false,
    },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key'],
        properties: {
          key: {
            type: 'string',
            nullable: false,
          },
          attributes: {
            type: 'object',
            nullable: true,
          },
        },
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['source', 'target'],
        properties: {
          key: {
            type: 'string',
          },
          source: {
            type: 'string',
          },
          target: {
            type: 'string',
          },
          undirected: {
            type: 'boolean',
          },
          attributes: {
            type: 'object',
          },
        },
      },
    },
  },
};
