import { describe, expect, it } from 'vitest';

import type {
  PartialBy,
  Rule,
  RuleFnResult,
  ThymianHttpRequest,
  ThymianHttpResponse,
} from '../../src/index.js';
import {
  NoopLogger,
  runRules,
  ThymianBaseError,
  ThymianFormat,
} from '../../src/index.js';
import { resolveViolationLocation } from '../../src/rules/rule-runner.js';

const minimalRequest: PartialBy<ThymianHttpRequest, 'label' | 'sourceName'> = {
  type: 'http-request',
  host: 'localhost',
  port: 80,
  protocol: 'http',
  path: '/test',
  method: 'get',
  headers: {},
  queryParameters: {},
  cookies: {},
  pathParameters: {},
  mediaType: '',
};

const minimalResponse: PartialBy<ThymianHttpResponse, 'label' | 'sourceName'> =
  {
    type: 'http-response',
    headers: {},
    mediaType: '',
    statusCode: 200,
  };

class TestRuleContext {
  constructor(private readonly diagnostics?: { detail: string }) {}

  getRuleExecutionDiagnostics(): { detail: string } | undefined {
    return this.diagnostics;
  }
}

describe('runRules', () => {
  it('should collect diagnostics by rule name', async () => {
    const diagnosticsByRuleName = {
      'rule-with-diagnostics': { detail: 'captured diagnostics' },
    };

    const rules: Rule[] = [
      {
        meta: {
          name: 'rule-with-diagnostics',
          type: ['test'],
          options: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
          },
          severity: 'warn',
        },
        testRule: () => [] as RuleFnResult,
      },
      {
        meta: {
          name: 'rule-without-diagnostics',
          type: ['test'],
          options: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
          },
          severity: 'hint',
        },
        testRule: () => [] as RuleFnResult,
      },
    ];

    const result = await runRules<TestRuleContext, { detail: string }>(
      new NoopLogger(),
      rules,
      new ThymianFormat(),
      {},
      {
        errorName: 'TestRuleRunnerError',
        mode: 'test',
        getRuleFn: (rule) => rule.testRule,
        createContext: (rule) =>
          new TestRuleContext(
            diagnosticsByRuleName[
              rule.meta.name as keyof typeof diagnosticsByRuleName
            ],
          ),
      },
    );

    expect(result['rule-with-diagnostics']?.diagnostics).toEqual({
      detail: 'captured diagnostics',
    });
    expect(result['rule-without-diagnostics']?.diagnostics).toBeUndefined();
  });
});

describe('resolveViolationLocation', () => {
  it('returns custom location for a string', () => {
    const format = new ThymianFormat();
    const result = resolveViolationLocation('GET /test', format, 'my-rule');
    expect(result).toEqual({
      heading: 'GET /test',
      location: { type: 'custom', value: 'GET /test' },
    });
  });

  it('returns thymianFormat edge location for an http-transaction edge', () => {
    const format = new ThymianFormat();
    const [, , transactionId] = format.addHttpTransaction(
      minimalRequest,
      minimalResponse,
      'test-source',
    );

    const result = resolveViolationLocation(
      { elementType: 'edge', elementId: transactionId },
      format,
      'my-rule',
    );

    expect(result.location).toMatchObject({
      type: 'thymianFormat',
      elementType: 'edge',
      elementId: transactionId,
    });
    expect(result.heading).toBeTruthy();
  });

  it('returns thymianFormat edge location for a non-http-transaction edge, using elementId as heading', () => {
    const format = new ThymianFormat();
    const [, resId] = format.addHttpTransaction(
      minimalRequest,
      minimalResponse,
      'test-source',
    );
    // Add a second request node so we can create an http-link
    const req2Id = format.addRequest({ ...minimalRequest, path: '/other' });
    const linkId = format.addHttpLink(resId, req2Id, {});

    const result = resolveViolationLocation(
      { elementType: 'edge', elementId: linkId },
      format,
      'my-rule',
    );

    expect(result.location).toMatchObject({
      type: 'thymianFormat',
      elementType: 'edge',
      elementId: linkId,
    });
    expect(result.heading).toBe(linkId);
  });

  it('throws when the edge does not exist in the format', () => {
    const format = new ThymianFormat();
    expect(() =>
      resolveViolationLocation(
        { elementType: 'edge', elementId: 'nonexistent' },
        format,
        'my-rule',
      ),
    ).toThrow(ThymianBaseError);
  });

  it('does not return file type for an http-transaction edge even when sourceLocation has a path', () => {
    const format = new ThymianFormat();
    const [, , transactionId] = format.addHttpTransaction(
      {
        ...minimalRequest,
        sourceLocation: {
          path: '/some/file.yaml',
          position: { line: 1, column: 0 },
        },
      },
      minimalResponse,
      'test-source',
    );

    const result = resolveViolationLocation(
      { elementType: 'edge', elementId: transactionId },
      format,
      'my-rule',
    );

    expect(result.location.type).toBe('thymianFormat');
  });
});
