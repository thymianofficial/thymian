import type { JSONSchemaType } from 'ajv/dist/2020.js';

import {
  type ThymianReport,
  thymianReportSchema,
} from '../events/report.event.js';
import type { RuleViolation } from '../rules/rule-violation.js';

export interface ValidationResult {
  status: 'success' | 'failed' | 'error';
  violations: RuleViolation[];
  reports: ThymianReport[];
  metadata?: Record<string, unknown>;
}

export const validationResultSchema = {
  type: 'object',
  nullable: false,
  required: ['status', 'violations', 'reports'],
  additionalProperties: false,
  properties: {
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
        required: ['rule', 'severity', 'location'],
        additionalProperties: false,
        properties: {
          rule: { type: 'string', nullable: false },
          severity: {
            type: 'string',
            enum: ['error', 'warn', 'hint'],
            nullable: false,
          },
          message: { type: 'string', nullable: true },
          summary: { type: 'string', nullable: true },
          metadata: {
            type: 'object',
            nullable: true,
            required: [],
            additionalProperties: true,
          },
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
        },
      },
    },
    reports: {
      type: 'array',
      nullable: false,
      items: thymianReportSchema,
    },
    metadata: {
      type: 'object',
      nullable: true,
      required: [],
      additionalProperties: true,
    },
  },
} as unknown as JSONSchemaType<ValidationResult>;
