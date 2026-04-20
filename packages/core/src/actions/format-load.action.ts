import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { SerializedThymianFormat } from '../format/index.js';
import type { Action } from './action.js';

export interface SpecificationInput {
  type: string;
  location: unknown;
  options?: Record<string, unknown>;
}

export interface CoreFormatLoadInput {
  inputs: SpecificationInput[];
  validateSpecs: boolean;
  options?: Record<string, unknown>;
}

export type FormatLoadAction = Action<
  CoreFormatLoadInput,
  SerializedThymianFormat
>;

export const specificationInputSchema = {
  type: 'object',
  nullable: false,
  required: ['type', 'location'],
  additionalProperties: false,
  properties: {
    type: { type: 'string', nullable: false },
    location: {},
    options: {
      type: 'object',
      nullable: true,
      required: [],
      additionalProperties: true,
    },
  },
} as unknown as JSONSchemaType<SpecificationInput>;

export const formatLoadActionSchema = {
  type: 'object',
  nullable: false,
  required: ['inputs', 'validateSpecs'],
  additionalProperties: false,
  properties: {
    inputs: {
      type: 'array',
      nullable: false,
      items: specificationInputSchema,
    },
    validateSpecs: {
      type: 'boolean',
      nullable: false,
    },
    options: {
      type: 'object',
      nullable: true,
      required: [],
      additionalProperties: true,
    },
  },
} as unknown as JSONSchemaType<CoreFormatLoadInput>;
