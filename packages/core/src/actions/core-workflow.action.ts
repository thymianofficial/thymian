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

// Serializable action-input types: the WS/action boundary cannot carry the
// non-serializable `ruleFilter` (a function) present on the `*WorkflowInput`
// method-input types, so it is omitted here. This keeps the action `event`
// type (and the AJV schemas below) aligned with what a WS client can actually
// send and what the schemas validate. `ruleFilter` stays on the internal
// `lint()`/`test()`/`analyze()` method inputs, fed by in-process callers.
export type LintWorkflowActionInput = Omit<LintWorkflowInput, 'ruleFilter'>;
export type TestWorkflowActionInput = Omit<TestWorkflowInput, 'ruleFilter'>;
export type AnalyzeWorkflowActionInput = Omit<
  AnalyzeWorkflowInput,
  'ruleFilter'
>;

export type WorkflowLintAction = Action<LintWorkflowActionInput, Report>;
export type WorkflowTestAction = Action<TestWorkflowActionInput, Report>;
export type WorkflowAnalyzeAction = Action<AnalyzeWorkflowActionInput, Report>;

// The `as unknown as JSONSchemaType<…>` double-cast on each schema is
// load-bearing, not stylistic: the schemas compose pre-cast sub-schemas
// (`specificationInputSchema` / `trafficInputSchema`, themselves `unknown`-cast
// because `location` is `unknown`), which a single `as` cannot verify — the
// same pattern as `formatLoadActionSchema`. The type argument is the
// ruleFilter-free `*WorkflowActionInput`, so `validate()` asserts exactly the
// contract these schemas enforce (`additionalProperties: false` still rejects
// `ruleFilter` or any extra property at runtime).
//
// Optional properties are NOT `nullable`: the input types never allow `null`
// (a field is skipped by omission, not by passing `null`). Marking e.g.
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
} as unknown as JSONSchemaType<LintWorkflowActionInput>;

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
} as unknown as JSONSchemaType<TestWorkflowActionInput>;

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
} as unknown as JSONSchemaType<AnalyzeWorkflowActionInput>;
