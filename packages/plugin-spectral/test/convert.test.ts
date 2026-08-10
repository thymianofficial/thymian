import { createMockLogger } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { convertResults } from '../src/convert.js';
import type { SpectralResult } from '../src/spectral-types.js';

function result(overrides: Partial<SpectralResult> = {}): SpectralResult {
  return {
    code: 'oas3-api-servers',
    message: 'OpenAPI "servers" must be present and non-empty array.',
    severity: 1,
    path: [],
    range: {
      start: { line: 0, character: 0 },
      end: { line: 22, character: 30 },
    },
    source: 'api.yaml',
    ...overrides,
  };
}

describe('convertResults', () => {
  it('maps Spectral severities 0/1/2/3 to error/warn/info/hint', () => {
    const logger = createMockLogger();

    const { executions } = convertResults(
      [
        result({ code: 'a', severity: 0 }),
        result({ code: 'b', severity: 1 }),
        result({ code: 'c', severity: 2 }),
        result({ code: 'd', severity: 3 }),
      ],
      { logger },
    );

    expect(
      executions.map((execution) =>
        execution.status.kind === 'failed'
          ? execution.status.severity
          : undefined,
      ),
    ).toEqual(['error', 'warn', 'info', 'hint']);
  });

  it('maps an unknown severity number to error and warns', () => {
    const logger = createMockLogger();

    const { executions } = convertResults([result({ severity: 9 })], {
      logger,
    });

    expect(executions[0]?.status).toMatchObject({
      kind: 'failed',
      severity: 'error',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('severity'),
    );
  });

  it('namespaces rule ids as spectral/<code> and stringifies numeric codes', () => {
    const logger = createMockLogger();

    const { executions } = convertResults(
      [result({ code: 'info-contact' }), result({ code: 42 })],
      { logger },
    );

    expect(executions.map((execution) => execution.ruleId)).toEqual([
      'spectral/info-contact',
      'spectral/42',
    ]);
  });

  it('produces failed lint executions preserving the message as reason', () => {
    const logger = createMockLogger();

    const { executions } = convertResults(
      [result({ message: 'Something is off.' })],
      { logger },
    );

    expect(executions[0]).toMatchObject({
      kind: 'lint',
      status: { kind: 'failed', reason: 'Something is off.' },
      findings: [],
    });
  });

  it('preserves source and 1-based line/column in the file fallback location (traceability)', () => {
    const logger = createMockLogger();

    const { executions } = convertResults(
      [
        result({
          source: 'api.yaml',
          range: {
            start: { line: 4, character: 2 },
            end: { line: 4, character: 10 },
          },
        }),
      ],
      { logger },
    );

    expect(executions[0]?.location).toEqual({
      type: 'file',
      path: 'api.yaml',
      line: 5,
      column: 3,
    });
  });

  it('derives one RuleDescriptor per distinct code with highest severity, first message, and helpUri', () => {
    const logger = createMockLogger();

    const { rules } = convertResults(
      [
        result({
          code: 'dup-rule',
          severity: 1,
          message: 'first message',
          documentationUrl: 'https://example.com/rules/dup-rule',
        }),
        result({ code: 'dup-rule', severity: 0, message: 'second message' }),
        result({ code: 'other-rule', severity: 3, message: 'other' }),
      ],
      { logger },
    );

    expect(rules).toHaveLength(2);
    expect(rules.find((rule) => rule.id === 'spectral/dup-rule')).toMatchObject(
      {
        severity: 'error',
        summary: { text: 'first message' },
        helpUri: 'https://example.com/rules/dup-rule',
      },
    );
    expect(
      rules.find((rule) => rule.id === 'spectral/other-rule'),
    ).toMatchObject({ severity: 'hint' });
  });

  it('converts an empty result list to empty executions and rules', () => {
    const logger = createMockLogger();

    const { executions, rules } = convertResults([], { logger });

    expect(executions).toEqual([]);
    expect(rules).toEqual([]);
  });
});
