import type { JSONSchemaType } from 'ajv/dist/2020.js';

export type ThymianReportSeverity = 'info' | 'hint' | 'warn' | 'error';

export interface ThymianReport {
  producer: string;
  source: string;
  severity: ThymianReportSeverity;
  summary: string;
  title: string;
  links?: { title?: string; url: string }[];
  timestamp?: number;
  details?: string;
  category?: string;
  location?: {
    uri?: string;
    format?: {
      elementType: 'node' | 'edge';
      id: string;
    };
    file?: {
      path: string;
      position: {
        line: number;
        column: number;
        offset: number;
      };
    };
  };
}

export type ReportFn = (report: ThymianReport) => void;

export type ReportEvent = ThymianReport;

export const thymianReportSchema: JSONSchemaType<ReportEvent> = {
  type: 'object',
  nullable: false,
  additionalProperties: false,
  required: ['producer', 'severity', 'summary', 'source', 'title'],
  properties: {
    producer: { type: 'string', nullable: false },
    source: { type: 'string', nullable: false },
    category: { type: 'string', nullable: true },
    title: { type: 'string', nullable: false },
    timestamp: { type: 'integer', nullable: true },
    severity: {
      type: 'string',
      enum: ['info', 'hint', 'warn', 'error'],
      nullable: false,
    },
    summary: { type: 'string', nullable: false },
    details: { type: 'string', nullable: true },
    links: {
      type: 'array',
      nullable: true,
      items: {
        type: 'object',
        nullable: false,
        required: ['url'],
        additionalProperties: false,
        properties: {
          title: { type: 'string', nullable: true },
          url: { type: 'string', nullable: false },
        },
      },
    },
    location: {
      type: 'object',
      nullable: true,
      additionalProperties: false,
      properties: {
        uri: { type: 'string', nullable: true },
        format: {
          type: 'object',
          nullable: true,
          required: ['id', 'elementType'],
          additionalProperties: false,
          properties: {
            elementType: {
              enum: ['edge', 'node'],
              type: 'string',
              nullable: false,
            },
            id: { type: 'string', nullable: false },
          },
        },
        file: {
          type: 'object',
          nullable: true,
          required: ['path', 'position'],
          additionalProperties: false,
          properties: {
            path: {
              type: 'string',
              nullable: false,
            },
            position: {
              type: 'object',
              nullable: false,
              required: ['line', 'column', 'offset'],
              additionalProperties: false,
              properties: {
                line: { type: 'integer', nullable: false },
                column: { type: 'integer', nullable: false },
                offset: { type: 'integer', nullable: false },
              },
            },
          },
        },
      },
    },
  },
};
