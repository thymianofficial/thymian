import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { WorkflowClassification } from './validation-result.js';

export interface SpecValidationIssue {
  message: string;
  path?: string;
  code?: string;
}

export interface SpecValidationResult {
  type: string;
  location: string;
  source: string;
  status: 'success' | 'failed' | 'error' | 'unsupported';
  issues: SpecValidationIssue[];
  metadata?: Record<string, unknown>;
}

export interface SpecValidationOutcome {
  classification: WorkflowClassification;
  results: SpecValidationResult[];
}

export const specValidationIssueSchema = {
  type: 'object',
  nullable: false,
  required: ['message'],
  additionalProperties: false,
  properties: {
    message: {
      type: 'string',
      nullable: false,
    },
    path: {
      type: 'string',
      nullable: true,
    },
    code: {
      type: 'string',
      nullable: true,
    },
  },
} as unknown as JSONSchemaType<SpecValidationIssue>;

export const specValidationResultSchema = {
  type: 'object',
  nullable: false,
  required: ['type', 'location', 'source', 'status', 'issues'],
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      nullable: false,
    },
    location: {
      type: 'string',
      nullable: false,
    },
    source: {
      type: 'string',
      nullable: false,
    },
    status: {
      type: 'string',
      enum: ['success', 'failed', 'error', 'unsupported'],
      nullable: false,
    },
    issues: {
      type: 'array',
      nullable: false,
      items: specValidationIssueSchema,
    },
    metadata: {
      type: 'object',
      nullable: true,
      required: [],
      additionalProperties: true,
    },
  },
} as unknown as JSONSchemaType<SpecValidationResult>;

export const specValidationResultsSchema = {
  type: 'array',
  nullable: false,
  items: specValidationResultSchema,
} as unknown as JSONSchemaType<SpecValidationResult[]>;
