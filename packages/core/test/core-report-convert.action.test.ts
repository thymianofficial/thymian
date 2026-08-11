import { describe, expect, it } from 'vitest';

import {
  convertedRunFragmentArraySchema,
  coreReportConvertActionSchema,
} from '../src/actions/core-report-convert.action.js';
import { toolRunArraySchema } from '../src/actions/tool-run-array.schema.js';
import { ajv } from '../src/ajv.js';
import { corePlugin } from '../src/core-plugin.js';

describe('coreReportConvertActionSchema (event)', () => {
  it('accepts a minimal valid input (only inputs)', () => {
    expect(
      ajv.validate(coreReportConvertActionSchema, {
        inputs: [{ type: 'spectral', location: './report.json' }],
      }),
    ).toBe(true);
  });

  it('accepts a fully populated valid input', () => {
    expect(
      ajv.validate(coreReportConvertActionSchema, {
        inputs: [
          {
            type: 'spectral',
            location: './report.json',
            options: { foo: 'bar' },
          },
        ],
        format: { attributes: { hash: 'abc' }, nodes: [], edges: [] },
        options: { verbose: true },
      }),
    ).toBe(true);
  });

  it('rejects input missing the required inputs', () => {
    expect(ajv.validate(coreReportConvertActionSchema, {})).toBe(false);
  });

  it('rejects an extra top-level property (additionalProperties: false)', () => {
    expect(
      ajv.validate(coreReportConvertActionSchema, {
        inputs: [],
        somethingElse: true,
      }),
    ).toBe(false);
  });

  it('rejects a wrong-typed field (inputs must be an array)', () => {
    expect(
      ajv.validate(coreReportConvertActionSchema, {
        inputs: 'spectral:./report.json',
      }),
    ).toBe(false);
  });

  it('rejects an input item missing the required location', () => {
    expect(
      ajv.validate(coreReportConvertActionSchema, {
        inputs: [{ type: 'spectral' }],
      }),
    ).toBe(false);
  });

  it('rejects an input item carrying an extra property (additionalProperties: false)', () => {
    expect(
      ajv.validate(coreReportConvertActionSchema, {
        inputs: [{ type: 'spectral', location: './report.json', bogus: 1 }],
      }),
    ).toBe(false);
  });

  it('rejects an input item with options: null (optional means omitted, not nullable)', () => {
    expect(
      ajv.validate(coreReportConvertActionSchema, {
        inputs: [
          { type: 'spectral', location: './report.json', options: null },
        ],
      }),
    ).toBe(false);
  });
});

describe('convertedRunFragmentArraySchema (response)', () => {
  const validRun = {
    runId: 'run-1',
    tool: { name: '@thymian/plugin-spectral' },
    runType: 'lint',
    runAt: '2026-08-05T00:00:00.000Z',
  };

  it('accepts an empty array (a listener that claimed nothing)', () => {
    expect(ajv.validate(convertedRunFragmentArraySchema, [])).toBe(true);
  });

  it('accepts a fully populated valid fragment array', () => {
    expect(
      ajv.validate(convertedRunFragmentArraySchema, [
        {
          input: { type: 'spectral', location: './report.json' },
          run: validRun,
        },
      ]),
    ).toBe(true);
  });

  it('accepts a fragment carrying a thymianFormat record (report-merge passthrough)', () => {
    expect(
      ajv.validate(convertedRunFragmentArraySchema, [
        {
          input: { type: 'thymian', location: './report.json' },
          run: { ...validRun, thymianFormatVersion: 'abc' },
          thymianFormat: {
            abc: { attributes: { hash: 'abc' }, nodes: [], edges: [] },
          },
        },
      ]),
    ).toBe(true);
  });

  it('rejects a fragment with thymianFormat: null (optional means omitted, not nullable)', () => {
    expect(
      ajv.validate(convertedRunFragmentArraySchema, [
        {
          input: { type: 'thymian', location: './report.json' },
          run: validRun,
          thymianFormat: null,
        },
      ]),
    ).toBe(false);
  });

  it('rejects a fragment missing the required run', () => {
    expect(
      ajv.validate(convertedRunFragmentArraySchema, [
        { input: { type: 'spectral', location: './report.json' } },
      ]),
    ).toBe(false);
  });

  it('rejects a fragment whose run is missing a required ToolRun field', () => {
    expect(
      ajv.validate(convertedRunFragmentArraySchema, [
        {
          input: { type: 'spectral', location: './report.json' },
          run: { tool: { name: 'x' }, runType: 'lint', runAt: 'now' },
        },
      ]),
    ).toBe(false);
  });

  it('rejects a fragment whose input location is not a string', () => {
    expect(
      ajv.validate(convertedRunFragmentArraySchema, [
        { input: { type: 'spectral', location: 42 }, run: validRun },
      ]),
    ).toBe(false);
  });

  it('rejects a fragment whose run.executions is not an array (mirrors toolRunArraySchema)', () => {
    expect(
      ajv.validate(convertedRunFragmentArraySchema, [
        {
          input: { type: 'spectral', location: './report.json' },
          run: { ...validRun, executions: 'not-an-array' },
        },
      ]),
    ).toBe(false);
  });
});

describe('corePlugin declares core.report.convert (AC1)', () => {
  const provides = corePlugin.actions?.provides;

  it('declares core.report.convert with its event and response schemas', () => {
    const declaration = provides?.['core.report.convert'];
    expect(declaration).toBeDefined();
    expect(declaration?.event).toBe(coreReportConvertActionSchema);
    expect(declaration?.response).toBe(convertedRunFragmentArraySchema);
  });
});

describe('detail and workflow actions are untouched (AC4)', () => {
  const provides = corePlugin.actions?.provides;

  it.each(['core.lint', 'core.test', 'core.analyze'] as const)(
    '%s still responds with toolRunArraySchema and keeps its empty event stub',
    (name) => {
      const declaration = provides?.[name];
      expect(declaration).toBeDefined();
      expect(declaration?.response).toBe(toolRunArraySchema);
      expect(declaration?.event).toEqual({});
    },
  );
});
