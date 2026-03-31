import type { JSONSchemaType } from 'ajv/dist/2020.js';

export type ThymianReportSeverity = 'info' | 'hint' | 'warn' | 'error';

export interface ThymianReportLocation {
  file?: {
    path?: string;
    uri?: string;
    position?: { line: number; column: number; offset: number };
  };
  format?: {
    elementType: 'node' | 'edge';
    elementId: string;
  };
}

export interface ThymianReportItem {
  severity: ThymianReportSeverity;
  message: string;
  ruleName?: string;
  details?: string;
  links?: { title?: string; url: string }[];
  location?: ThymianReportLocation;
}

export interface ThymianReportSection {
  heading: string;
  items: ThymianReportItem[];
  location?: ThymianReportLocation;
}

export interface ThymianReport {
  source: string;
  message: string;
  sections?: ThymianReportSection[];
  metadata?: Record<string, unknown>;
}

export type ReportFn = (report: ThymianReport) => void;

export type ReportEvent = ThymianReport;

const thymianReportLocationSchema = {
  type: 'object',
  nullable: true,
  additionalProperties: false,
  properties: {
    file: {
      type: 'object',
      nullable: true,
      additionalProperties: false,
      properties: {
        path: { type: 'string', nullable: true },
        uri: { type: 'string', nullable: true },
        position: {
          type: 'object',
          nullable: true,
          additionalProperties: false,
          required: ['line', 'column', 'offset'] as const,
          properties: {
            line: { type: 'integer', nullable: false },
            column: { type: 'integer', nullable: false },
            offset: { type: 'integer', nullable: false },
          },
        },
      },
    },
    format: {
      type: 'object',
      nullable: true,
      additionalProperties: false,
      required: ['elementType', 'elementId'] as const,
      properties: {
        elementType: {
          type: 'string',
          enum: ['node', 'edge'],
          nullable: false,
        },
        elementId: { type: 'string', nullable: false },
      },
    },
  },
} as const;

const thymianReportItemSchema = {
  type: 'object',
  nullable: false,
  additionalProperties: false,
  required: ['severity', 'message'] as const,
  properties: {
    severity: {
      type: 'string',
      enum: ['info', 'hint', 'warn', 'error'],
      nullable: false,
    },
    message: { type: 'string', nullable: false },
    ruleName: { type: 'string', nullable: true },
    details: { type: 'string', nullable: true },
    links: {
      type: 'array',
      nullable: true,
      items: {
        type: 'object',
        nullable: false,
        required: ['url'] as const,
        additionalProperties: false,
        properties: {
          title: { type: 'string', nullable: true },
          url: { type: 'string', nullable: false },
        },
      },
    },
    location: thymianReportLocationSchema,
  },
} as const;

const thymianReportSectionSchema = {
  type: 'object',
  nullable: false,
  additionalProperties: false,
  required: ['heading', 'items'] as const,
  properties: {
    heading: { type: 'string', nullable: false },
    items: {
      type: 'array',
      nullable: false,
      items: thymianReportItemSchema,
    },
    location: thymianReportLocationSchema,
  },
} as const;

export const thymianReportSchema: JSONSchemaType<ReportEvent> = {
  type: 'object',
  nullable: false,
  additionalProperties: false,
  required: ['source', 'message'],
  properties: {
    source: { type: 'string', nullable: false },
    message: { type: 'string', nullable: false },
    sections: {
      type: 'array',
      nullable: true,
      items: thymianReportSectionSchema,
    },
    metadata: {
      type: 'object',
      nullable: true,
      required: [] as const,
      additionalProperties: true,
    },
  },
} as unknown as JSONSchemaType<ReportEvent>;
