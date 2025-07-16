import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { SerializedThymianFormat } from '../format/index.js';
import type { Action } from './action.js';

export interface RunActionResponse {
  pluginName: string;
  status: 'success' | 'failed' | 'error';
  message?: string;
}

export type RunAction = Action<SerializedThymianFormat, RunActionResponse>;

export const runActionSchema: JSONSchemaType<RunActionResponse> = {
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
