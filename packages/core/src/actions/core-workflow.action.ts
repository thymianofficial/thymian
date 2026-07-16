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
//
// Optional properties are NOT `nullable`: the `*WorkflowInput` types never allow
// `null` (a field is skipped by omission, not by passing `null`). Marking e.g.
// `rulesConfig` nullable would let a client send `null` past validation and then
// crash downstream in `loadRules` (which indexes into it as an object),
// bypassing the fail-fast `InvalidActionInputError` contract.
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
    rules: { type: 'array', items: { type: 'string' } },
    rulesConfig: {
      type: 'object',
      required: [],
      additionalProperties: true,
    },
    options: {
      type: 'object',
      required: [],
      additionalProperties: true,
    },
    validateSpecs: { type: 'boolean' },
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
    rules: { type: 'array', items: { type: 'string' } },
    rulesConfig: {
      type: 'object',
      required: [],
      additionalProperties: true,
    },
    options: {
      type: 'object',
      required: [],
      additionalProperties: true,
    },
    validateSpecs: { type: 'boolean' },
    targetUrl: { type: 'string' },
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
      items: specificationInputSchema,
    },
    traffic: { type: 'array', nullable: false, items: trafficInputSchema },
    rules: { type: 'array', items: { type: 'string' } },
    rulesConfig: {
      type: 'object',
      required: [],
      additionalProperties: true,
    },
    options: {
      type: 'object',
      required: [],
      additionalProperties: true,
    },
    validateSpecs: { type: 'boolean' },
    validateTrafficSource: { type: 'boolean' },
  },
} as unknown as JSONSchemaType<AnalyzeWorkflowInput>;
