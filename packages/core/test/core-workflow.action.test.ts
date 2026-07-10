import { describe, expect, it } from 'vitest';

import {
  workflowAnalyzeActionSchema,
  workflowLintActionSchema,
  workflowTestActionSchema,
} from '../src/actions/core-workflow.action.js';
import { toolRunArraySchema } from '../src/actions/tool-run-array.schema.js';
import { ajv } from '../src/ajv.js';
import { corePlugin } from '../src/core-plugin.js';
import { reportSchema } from '../src/events/report.event.js';

describe('core.workflow.* input schemas', () => {
  describe('workflowLintActionSchema', () => {
    it('accepts a minimal valid input (only specification)', () => {
      expect(
        ajv.validate(workflowLintActionSchema, {
          specification: [{ type: 'openapi', location: 'api.yaml' }],
        }),
      ).toBe(true);
    });

    it('accepts a fully populated valid input', () => {
      expect(
        ajv.validate(workflowLintActionSchema, {
          specification: [{ type: 'openapi', location: 'api.yaml' }],
          rules: ['content-type-charset'],
          rulesConfig: { 'content-type-charset': 'warn' },
          options: { verbose: true },
          validateSpecs: true,
        }),
      ).toBe(true);
    });

    it('rejects input missing the required specification', () => {
      expect(ajv.validate(workflowLintActionSchema, {})).toBe(false);
    });

    it('rejects input carrying a non-serializable ruleFilter (additionalProperties: false)', () => {
      expect(
        ajv.validate(workflowLintActionSchema, {
          specification: [],
          ruleFilter: () => true,
        }),
      ).toBe(false);
    });

    it('rejects a wrong-typed field (rules must be an array)', () => {
      expect(
        ajv.validate(workflowLintActionSchema, {
          specification: [],
          rules: 'content-type-charset',
        }),
      ).toBe(false);
    });
  });

  describe('workflowTestActionSchema', () => {
    it('accepts a minimal valid input (only specification)', () => {
      expect(
        ajv.validate(workflowTestActionSchema, {
          specification: [{ type: 'openapi', location: 'api.yaml' }],
        }),
      ).toBe(true);
    });

    it('accepts a fully populated valid input including targetUrl', () => {
      expect(
        ajv.validate(workflowTestActionSchema, {
          specification: [{ type: 'openapi', location: 'api.yaml' }],
          rules: ['order-lifecycle'],
          rulesConfig: { 'order-lifecycle': 'error' },
          options: { retries: 2 },
          validateSpecs: false,
          targetUrl: 'https://api.example.com',
        }),
      ).toBe(true);
    });

    it('rejects input missing the required specification', () => {
      expect(
        ajv.validate(workflowTestActionSchema, {
          targetUrl: 'https://api.example.com',
        }),
      ).toBe(false);
    });

    it('rejects input carrying a ruleFilter (additionalProperties: false)', () => {
      expect(
        ajv.validate(workflowTestActionSchema, {
          specification: [],
          ruleFilter: () => true,
        }),
      ).toBe(false);
    });

    it('rejects a wrong-typed field (targetUrl must be a string)', () => {
      expect(
        ajv.validate(workflowTestActionSchema, {
          specification: [],
          targetUrl: 42,
        }),
      ).toBe(false);
    });
  });

  describe('workflowAnalyzeActionSchema', () => {
    it('accepts a minimal valid input (only traffic)', () => {
      expect(
        ajv.validate(workflowAnalyzeActionSchema, {
          traffic: [{ type: 'har', location: 'traffic.har' }],
        }),
      ).toBe(true);
    });

    it('accepts a fully populated valid input with traffic, specification and validateTrafficSource', () => {
      expect(
        ajv.validate(workflowAnalyzeActionSchema, {
          traffic: [{ type: 'har', location: 'traffic.har' }],
          specification: [{ type: 'openapi', location: 'api.yaml' }],
          rules: ['schema-conforms'],
          rulesConfig: { 'schema-conforms': 'error' },
          options: { strict: true },
          validateSpecs: true,
          validateTrafficSource: true,
        }),
      ).toBe(true);
    });

    it('rejects input missing the required traffic (specification alone is not enough)', () => {
      expect(
        ajv.validate(workflowAnalyzeActionSchema, {
          specification: [{ type: 'openapi', location: 'api.yaml' }],
        }),
      ).toBe(false);
    });

    it('rejects input carrying a ruleFilter (additionalProperties: false)', () => {
      expect(
        ajv.validate(workflowAnalyzeActionSchema, {
          traffic: [],
          ruleFilter: () => true,
        }),
      ).toBe(false);
    });

    it('rejects a wrong-typed field (traffic must be an array)', () => {
      expect(
        ajv.validate(workflowAnalyzeActionSchema, {
          traffic: 'traffic.har',
        }),
      ).toBe(false);
    });
  });
});

describe('corePlugin action declarations (AC1)', () => {
  const provides = corePlugin.actions?.provides;

  it.each([
    ['core.workflow.lint', workflowLintActionSchema],
    ['core.workflow.test', workflowTestActionSchema],
    ['core.workflow.analyze', workflowAnalyzeActionSchema],
  ] as const)(
    'declares %s with its event schema and response: reportSchema',
    (name, eventSchema) => {
      const declaration = provides?.[name];
      expect(declaration).toBeDefined();
      expect(declaration?.event).toBe(eventSchema);
      expect(declaration?.response).toBe(reportSchema);
    },
  );
});

describe('detail actions are untouched (AC7)', () => {
  const provides = corePlugin.actions?.provides;

  it.each(['core.lint', 'core.test', 'core.analyze'] as const)(
    '%s still responds with toolRunArraySchema and keeps its empty event stub',
    (name) => {
      const declaration = provides?.[name];
      expect(declaration).toBeDefined();
      expect(declaration?.response).toBe(toolRunArraySchema);
      // The detail actions declare no input schema (event is the `{}` stub);
      // guard that this change set did not accidentally attach one.
      expect(declaration?.event).toEqual({});
    },
  );
});
