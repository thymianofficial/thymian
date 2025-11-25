import type { ThymianPluginEvents } from '../thymian-plugin.js';

export type RegisterPluginEvent = {
  name: string;
  options: unknown;
  events: ThymianPluginEvents;
};

export const RegisterPluginEventSchema = {
  type: 'object',
  required: ['name', 'options', 'events', 'hooks'],
  properties: {
    name: { type: 'string' },
    options: {},
    events: {
      type: 'object',
      properties: {
        emits: { type: 'object', additionalProperties: true },
        listens: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
    hooks: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          input: { type: 'object', additionalProperties: true },
          output: { type: 'object', additionalProperties: true },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;
