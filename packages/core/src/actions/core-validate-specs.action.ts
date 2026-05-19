import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { Action } from './action.js';
import {
  type SpecificationInput,
  specificationInputSchema,
} from './format-load.action.js';
import type { SpecValidationResult } from './spec-validation-result.js';

export interface CoreValidateSpecsInput {
  inputs: SpecificationInput[];
}

export type CoreValidateSpecsAction = Action<
  CoreValidateSpecsInput,
  SpecValidationResult[]
>;

export const coreValidateSpecsActionSchema = {
  type: 'object',
  nullable: false,
  required: ['inputs'],
  additionalProperties: false,
  properties: {
    inputs: {
      type: 'array',
      nullable: false,
      items: specificationInputSchema,
    },
  },
} as unknown as JSONSchemaType<CoreValidateSpecsInput>;
