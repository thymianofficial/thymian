import type { JSONSchemaType } from 'ajv/dist/2020.js';

export interface ThymianReport {
  topic: string;
  subTopic?: string;
  title: string;
  text: string;
  isProblem: boolean;
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
    text: {
      type: 'string',
      nullable: false,
    },
    isProblem: {
      type: 'boolean',
      nullable: false,
    },
  },
};
