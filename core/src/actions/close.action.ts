import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { Action } from './action.js';

export interface CloseActionResponse {
  pluginName: string;
  status: 'success' | 'failed' | 'error';
  message?: string;
}

export type CloseAction = Action<void, CloseActionResponse>;

export const closeHookSchema: JSONSchemaType<CloseActionResponse> = {
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
