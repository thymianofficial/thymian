import type { JSONSchemaType } from 'ajv/dist/2020.js';

export interface ThymianReport {
  topic: string;
  subTopic?: string;
  title: string;
  severity?: 'hint' | 'warn' | 'error' | 'off';
  text: string;
  subText?: string;
  isProblem: boolean;
  location?: {
    format?: {
      elementType: 'node' | 'edge';
      id: string;
    };
    file?: string;
  };
}

export type ReportFn = (report: ThymianReport) => void;

export type ReportEvent = ThymianReport;

export const thymianReportSchema: JSONSchemaType<ReportEvent> = {
  type: 'object',
  nullable: false,
  additionalProperties: false,
  required: ['topic', 'title', 'text', 'isProblem'],
  properties: {
    topic: {
      type: 'string',
      nullable: false,
    },
    subTopic: {
      type: 'string',
      nullable: true,
    },
    title: {
      type: 'string',
      nullable: false,
    },
    severity: {
      type: 'string',
      enum: ['hint', 'warn', 'error', 'off'],
      nullable: true,
    },
    text: {
      type: 'string',
      nullable: false,
    },
    subText: {
      type: 'string',
      nullable: true,
    },
    isProblem: {
      type: 'boolean',
      nullable: false,
    },
    location: {
      type: 'object',
      nullable: true,
      additionalProperties: false,
      properties: {
        file: {
          type: 'string',
          nullable: true,
        },
        format: {
          type: 'object',
          nullable: true,
          required: ['id', 'elementType'],
          properties: {
            elementType: {
              enum: ['edge', 'node'],
              type: 'string',
              nullable: false,
            },
            id: {
              type: 'string',
              nullable: false,
            },
          },
        },
      },
    },
  },
};
