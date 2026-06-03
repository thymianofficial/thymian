import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { ThymianPluginEvents } from '../thymian-plugin.js';

export type RegisterPluginEvent = {
  name: string;
  options: Record<string, unknown>;
  events: ThymianPluginEvents;
};

export const RegisterPluginEventSchema: JSONSchemaType<RegisterPluginEvent> = {
  type: 'object',
  required: ['name', 'options', 'events'],
  properties: {
    name: { type: 'string' },
    options: { type: 'object', additionalProperties: true },
    events: {
      type: 'object',
      properties: {
        provides: {
          type: 'object',
          additionalProperties: true,
          nullable: true,
        },
        emits: { type: 'array', items: { type: 'string' }, nullable: true },
        listensOn: { type: 'array', items: { type: 'string' }, nullable: true },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;
