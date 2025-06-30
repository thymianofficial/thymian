import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { Hook } from './hook.js';

export interface CloseHookResult {
  pluginName: string;
  status: 'success' | 'failed' | 'error';
  message?: string;
}

export type CloseHook = Hook<never, CloseHookResult>;

export const closeHookSchema: JSONSchemaType<CloseHookResult> = {
  type: 'object',
  properties: {
    pluginName: { type: 'string', nullable: false },
    status: {
      type: 'string',
      enum: ['success', 'failed', 'error'],
      nullable: false,
    },
    message: { type: 'string', nullable: true },
  },
  required: ['pluginName', 'status'],
  additionalProperties: false,
  nullable: false,
};
