import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { ToolRun } from '../report/index.js';

export const toolRunArraySchema = {
  type: 'array',
  nullable: false,
  items: {
    type: 'object',
    nullable: false,
    required: ['runId', 'tool', 'runType', 'runAt'],
    additionalProperties: true,
    properties: {
      runId: { type: 'string', nullable: false },
      runType: { type: 'string', nullable: false },
      runAt: { type: 'string', nullable: false },
      tool: {
        type: 'object',
        nullable: false,
        required: ['name'],
        additionalProperties: true,
        properties: {
          name: { type: 'string', nullable: false },
          version: { type: 'string', nullable: true },
        },
      },
      executions: {
        type: 'array',
        nullable: true,
        items: {} as JSONSchemaType<unknown>,
      },
    },
  },
} as unknown as JSONSchemaType<ToolRun[]>;
