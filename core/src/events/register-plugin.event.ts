import type { ThymianPluginEvents, ThymianPluginHooks } from '../plugin.js';

export type RegisterPluginEvent = [
  {
    name: string;
    options: Record<PropertyKey, unknown>;
    events: ThymianPluginEvents;
    hooks: ThymianPluginHooks;
  }
];

export const RegisterPluginEventSchema = {
  type: 'object',
  required: ['name', 'options', 'events', 'hooks'],
  properties: {
    name: { type: 'string' },
    options: { type: 'object', additionalProperties: true },
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
