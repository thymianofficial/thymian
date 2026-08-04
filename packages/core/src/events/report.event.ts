import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { Report } from '../report/index.js';

export type ReportEvent = Report;

/**
 * Loose location schema shared by `Execution.location` and `TestStep.location`.
 * `Location` is a closed union (`thymianFormat` | `url` | `file` | `custom`);
 * this only asserts `type` is present and leaves per-variant fields
 * (`elementId`, `url`, `path`, `value`, …) to `additionalProperties`.
 */
const locationSchema = {
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
} as unknown as JSONSchemaType<unknown>;

/**
 * `FindingRecord` schema. Severity no longer lives on findings — it is
 * resolved from the owning execution's `ruleId`/`status` (see
 * `resolveExecutionSeverity`) — so it is intentionally absent here.
 */
const findingSchema = {
  type: 'object',
  nullable: false,
  required: ['id', 'kind', 'title'],
  additionalProperties: true,
  properties: {
    id: { type: 'string', nullable: false },
    kind: { type: 'string', nullable: false },
    title: { type: 'string', nullable: false },
  },
} as unknown as JSONSchemaType<unknown>;

/**
 * `Execution` schema. Executions are a flat, per-runType union of leaf
 * executions: `LintExecution`/`AnalyzeExecution`
 * (`location` + `findings`) and `TestCaseExecution` (`name` + `steps`, no
 * `location`); executions do not nest. `kind` and `status` are the only fields
 * common to every variant, so only those are `required`; the rest are optional
 * and validated loosely rather than as a strict discriminated union (ajv's
 * `JSONSchemaType` cannot express "required iff kind === X" without repeating
 * the whole union per branch).
 */
const executionSchema = {
  type: 'object',
  nullable: false,
  required: ['kind', 'status'],
  additionalProperties: true,
  properties: {
    kind: {
      type: 'string',
      enum: ['lint', 'analyze', 'test'],
      nullable: false,
    },
    ruleId: { type: 'string', nullable: true },
    status: {
      type: 'object',
      nullable: false,
      required: ['kind'],
      additionalProperties: true,
      properties: {
        kind: {
          type: 'string',
          enum: ['passed', 'failed', 'skipped'],
          nullable: false,
        },
        reason: { type: 'string', nullable: true },
        durationMilliseconds: { type: 'number', nullable: true },
        severity: {
          type: 'string',
          enum: ['error', 'warn', 'info', 'hint'],
          nullable: true,
        },
      },
    },
    // Present on LintExecution/AnalyzeExecution only.
    location: { ...locationSchema, nullable: true },
    findings: {
      type: 'array',
      nullable: true,
      items: findingSchema,
    },
    // Present on TestCaseExecution only.
    name: { type: 'string', nullable: true },
    steps: {
      type: 'array',
      nullable: true,
      items: {
        type: 'object',
        nullable: false,
        required: ['name', 'location', 'findings'],
        additionalProperties: true,
        properties: {
          name: { type: 'string', nullable: false },
          location: locationSchema,
          findings: {
            type: 'array',
            nullable: false,
            items: findingSchema,
          },
          httpTransactions: {
            type: 'array',
            nullable: true,
            items: {} as JSONSchemaType<unknown>,
          },
        },
      } as unknown as JSONSchemaType<unknown>,
    },
  },
} as unknown as JSONSchemaType<unknown>;

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
            items: executionSchema,
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
    thymianFormat: {
      type: 'object',
      nullable: true,
      additionalProperties: true,
    },
  },
} as unknown as JSONSchemaType<ReportEvent>;
