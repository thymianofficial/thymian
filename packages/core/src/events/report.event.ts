import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { Report } from '../report/index.js';

export type ReportEvent = Report;

export const reportSchema = {
  type: 'object',
  nullable: false,
  required: ['reportId', 'createdAt', 'runs'],
  additionalProperties: true,
  properties: {
    reportId: { type: 'string', nullable: false },
    createdAt: { type: 'string', nullable: false },
    runs: {
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
            items: {
              type: 'object',
              nullable: false,
              required: ['location', 'findings'],
              additionalProperties: true,
              properties: {
                name: { type: 'string', nullable: true },
                description: { type: 'string', nullable: true },
                location: {
                  type: 'object',
                  nullable: false,
                  required: ['type'],
                  additionalProperties: true,
                  properties: {
                    type: { type: 'string', nullable: false },
                    elementType: {
                      type: 'string',
                      enum: ['node', 'edge'],
                      nullable: true,
                    },
                  },
                },
                findings: {
                  type: 'array',
                  nullable: false,
                  items: {
                    type: 'object',
                    nullable: false,
                    required: ['id', 'kind', 'title', 'severity'],
                    additionalProperties: true,
                    properties: {
                      id: { type: 'string', nullable: false },
                      kind: { type: 'string', nullable: false },
                      title: { type: 'string', nullable: false },
                      severity: {
                        type: 'string',
                        enum: ['error', 'warn', 'info', 'hint'],
                        nullable: false,
                      },
                    },
                  },
                },
                children: {
                  type: 'array',
                  nullable: true,
                  items: {} as JSONSchemaType<unknown>,
                },
                httpTransactions: {
                  type: 'array',
                  nullable: true,
                  items: {} as JSONSchemaType<unknown>,
                },
              },
            },
          },
          rules: {
            type: 'array',
            nullable: true,
            items: {} as JSONSchemaType<unknown>,
          },
          duration: { type: 'number', nullable: true },
          thymianFormatVersion: { type: 'string', nullable: true },
          artifacts: {
            type: 'array',
            nullable: true,
            items: {} as JSONSchemaType<unknown>,
          },
          invocations: {
            type: 'array',
            nullable: true,
            items: {} as JSONSchemaType<unknown>,
          },
        },
      },
    },
  },
} as unknown as JSONSchemaType<ReportEvent>;
