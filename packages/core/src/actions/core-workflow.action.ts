import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { Report } from '../report/index.js';
// IMPORTANT: keep this a type-only import. Importing the `*WorkflowInput` types
// as values would create a runtime import cycle
// (thymian.ts -> core-plugin.ts -> actions/index.ts -> core-workflow.action.ts
// -> thymian.ts). `verbatimModuleSyntax` erases `import type`, so this stays
// acyclic at runtime (guarded by the `import/no-cycle` eslint rule).
import type {
  AnalyzeWorkflowInput,
  LintWorkflowInput,
  TestWorkflowInput,
} from '../thymian.js';
import type { Action } from './action.js';
import { specificationInputSchema } from './format-load.action.js';
import { trafficInputSchema } from './traffic-load.action.js';

export type WorkflowLintAction = Action<LintWorkflowInput, Report>;
export type WorkflowTestAction = Action<TestWorkflowInput, Report>;
export type WorkflowAnalyzeAction = Action<AnalyzeWorkflowInput, Report>;

// The `as unknown as JSONSchemaType<…>` double-cast on each schema is
// load-bearing, not stylistic: the schemas intentionally omit the non-
// serializable `ruleFilter` field present on the `*WorkflowInput` types, so a
// `satisfies JSONSchemaType<…>` would not compile. `additionalProperties: false`
// still rejects a `ruleFilter` (or any extra) property at validation time.
export const workflowLintActionSchema = {
  type: 'object',
  nullable: false,
  required: ['specification'],
  additionalProperties: false,
  properties: {
    specification: {
      type: 'array',
      nullable: false,
      items: specificationInputSchema,
    },
    rules: { type: 'array', nullable: true, items: { type: 'string' } },
    rulesConfig: {
      type: 'object',
      nullable: true,
      required: [],
      additionalProperties: true,
    },
    options: {
      type: 'object',
      nullable: true,
      required: [],
      additionalProperties: true,
    },
    validateSpecs: { type: 'boolean', nullable: true },
  },
} as unknown as JSONSchemaType<LintWorkflowInput>;

export const workflowTestActionSchema = {
  type: 'object',
  nullable: false,
  required: ['specification'],
  additionalProperties: false,
  properties: {
    specification: {
      type: 'array',
      nullable: false,
      items: specificationInputSchema,
    },
    rules: { type: 'array', nullable: true, items: { type: 'string' } },
    rulesConfig: {
      type: 'object',
      nullable: true,
      required: [],
      additionalProperties: true,
    },
    options: {
      type: 'object',
      nullable: true,
      required: [],
      additionalProperties: true,
    },
    validateSpecs: { type: 'boolean', nullable: true },
    targetUrl: { type: 'string', nullable: true },
  },
} as unknown as JSONSchemaType<TestWorkflowInput>;

export const workflowAnalyzeActionSchema = {
  type: 'object',
  nullable: false,
  required: ['traffic'],
  additionalProperties: false,
  properties: {
    specification: {
      type: 'array',
      nullable: true,
      items: specificationInputSchema,
    },
    traffic: { type: 'array', nullable: false, items: trafficInputSchema },
    rules: { type: 'array', nullable: true, items: { type: 'string' } },
    rulesConfig: {
      type: 'object',
      nullable: true,
      required: [],
      additionalProperties: true,
    },
    options: {
      type: 'object',
      nullable: true,
      required: [],
      additionalProperties: true,
    },
    validateSpecs: { type: 'boolean', nullable: true },
    validateTrafficSource: { type: 'boolean', nullable: true },
  },
} as unknown as JSONSchemaType<AnalyzeWorkflowInput>;
