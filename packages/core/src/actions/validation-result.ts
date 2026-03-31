import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { RuleRunnerStatistics } from '../rules/rule-runner.js';
import type { EvaluatedRuleViolation } from '../rules/rule-violation.js';

export interface ValidationResult {
  source: string;
  status: 'success' | 'failed' | 'error';
  violations: EvaluatedRuleViolation[];
  statistics?: RuleRunnerStatistics;
  metadata?: Record<string, unknown>;
}

export const validationResultSchema = {
  type: 'object',
  nullable: false,
  required: ['source', 'status', 'violations'],
  additionalProperties: false,
  properties: {
    source: {
      type: 'string',
      nullable: false,
    },
    status: {
      type: 'string',
      enum: ['success', 'failed', 'error'],
      nullable: false,
    },
    violations: {
      type: 'array',
      nullable: false,
      items: {
        type: 'object',
        nullable: false,
        required: ['ruleName', 'severity', 'violation'],
        additionalProperties: false,
        properties: {
          ruleName: { type: 'string', nullable: false },
          severity: {
            type: 'string',
            enum: ['error', 'warn', 'hint'],
            nullable: false,
          },
          violation: {
            type: 'object',
            nullable: false,
            required: ['location'],
            additionalProperties: false,
            properties: {
              location: {
                oneOf: [
                  { type: 'string', nullable: true },
                  {
                    type: 'object',
                    nullable: true,
                    required: ['elementType', 'elementId'],
                    additionalProperties: false,
                    properties: {
                      elementType: {
                        type: 'string',
                        enum: ['node', 'edge'],
                        nullable: false,
                      },
                      elementId: { type: 'string', nullable: false },
                      pointer: { type: 'string', nullable: true },
                      label: { type: 'string', nullable: true },
                    },
                  },
                ],
              },
              message: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
    statistics: {
      type: 'object',
      nullable: true,
      additionalProperties: false,
      properties: {
        rulesRun: { type: 'integer', nullable: false },
        rulesWithViolations: { type: 'integer', nullable: false },
      },
    },
    metadata: {
      type: 'object',
      nullable: true,
      required: [],
      additionalProperties: true,
    },
  },
} as unknown as JSONSchemaType<ValidationResult>;
