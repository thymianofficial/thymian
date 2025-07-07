import type { SerializedThymianFormat } from '../format/index.js';
import type { Action } from './action.js';

export type LoadFormatAction = Action<never, SerializedThymianFormat>;

export const loadFormatHookSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['options', 'attributes', 'nodes', 'edges'],
  properties: {
    options: {
      type: 'object',
    },
    attributes: {
      type: 'object',
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
          },
          attributes: {
            type: 'object',
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
