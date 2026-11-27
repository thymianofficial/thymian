import { describe, expect, it } from 'vitest';

import type {
  PartialBy,
  Rule,
  RuleFnResult,
  RuleRunnerAdapter,
  ThymianHttpRequest,
  ThymianHttpResponse,
} from '../../src/index.js';
import {
  locateOnGroup,
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

type StubContextRuleFn = ReturnType<
  RuleRunnerAdapter<TestRuleContext, { detail: string }>['getRuleFn']
>;

// The rules under test never read their context, so the runner is driven with
// TestRuleContext, a stub that is deliberately not a TestContext or LintContext.
function withStubContext(
  ruleFn: Rule['testRule'] | Rule['lintRule'],
): StubContextRuleFn {
  return ruleFn as unknown as StubContextRuleFn;
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
        testRule: () => [],
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
        testRule: () => [],
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
        getRuleFn: (rule) => withStubContext(rule.testRule),
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

  it('does not run a rule in a mode its meta.type excludes, even if the mode function is present', async () => {
    // A profile (or user config) narrowed this rule's type to `test`, but the
    // now-unused `lintRule` function is still on the object. Dispatch must key
    // on meta.type, not function presence, so the static runner skips it.
    const narrowedRule: Rule = {
      meta: {
        name: 'narrowed-to-test',
        type: ['test'],
        options: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
        severity: 'error',
      },
      lintRule: () => [],
      testRule: () => [],
    };

    const staticResult = await runRules<TestRuleContext>(
      new NoopLogger(),
      [narrowedRule],
      new ThymianFormat(),
      {},
      {
        errorName: 'TestRuleRunnerError',
        mode: 'static',
        getRuleFn: (rule) => withStubContext(rule.lintRule),
        createContext: () => new TestRuleContext(),
      },
    );

    expect(staticResult['narrowed-to-test']).toBeUndefined();

    const testResult = await runRules<TestRuleContext>(
      new NoopLogger(),
      [narrowedRule],
      new ThymianFormat(),
      {},
      {
        errorName: 'TestRuleRunnerError',
        mode: 'test',
        getRuleFn: (rule) => withStubContext(rule.testRule),
        createContext: () => new TestRuleContext(),
      },
    );

    expect(testResult['narrowed-to-test']).toBeDefined();
  });

  describe('a group location a rule returns', () => {
    const member = { elementType: 'edge' as const, elementId: 'get-users' };

    function ruleReturning(location: unknown): Rule {
      return {
        meta: {
          name: 'grouped-rule',
          type: ['test'],
          options: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
          },
          severity: 'error',
        },
        testRule: () => [
          {
            location: location as RuleFnResult['location'],
            violation: {},
            findings: [],
          },
        ],
      };
    }

    function run(rule: Rule) {
      return runRules<TestRuleContext>(
        new NoopLogger(),
        [rule],
        new ThymianFormat(),
        {},
        {
          errorName: 'TestRuleRunnerError',
          mode: 'test',
          getRuleFn: (rule) => withStubContext(rule.testRule),
          createContext: () => new TestRuleContext(),
        },
      );
    }

    function groupFromContext() {
      const [result] = locateOnGroup(
        [{ location: '/users', findings: [] }],
        '/users',
        [member],
      );

      if (typeof result?.location !== 'object') {
        throw new Error('locateOnGroup returned no group location');
      }

      return result.location;
    }

    it('keeps one a validation context made', async () => {
      const group = groupFromContext();

      const result = await run(ruleReturning(group));

      expect(result['grouped-rule']?.ruleFnResult[0]?.location).toBe(group);
    });

    it('rejects one the rule made itself', async () => {
      const forged = { elementType: 'group', key: '/users', members: [member] };

      const running = run(ruleReturning(forged));

      await expect(running).rejects.toMatchObject({
        name: 'TestRuleRunnerError',
        cause: { name: 'InvalidRuleViolationLocationError' },
      });
    });

    it('rejects a copy of one a validation context made', async () => {
      const group = groupFromContext();

      const running = run(ruleReturning({ ...group }));

      await expect(running).rejects.toMatchObject({
        name: 'TestRuleRunnerError',
        cause: { name: 'InvalidRuleViolationLocationError' },
      });
    });
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

  it('shows a group by its key, as a custom location, even a copy of one', () => {
    const format = new ThymianFormat();
    const [located] = locateOnGroup(
      [{ location: 'https://localhost/test', findings: [] }],
      'https://localhost/test',
      [{ elementType: 'edge', elementId: 'not-looked-up' }],
    );
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const copy = structuredClone(located!.location);

    const result = resolveViolationLocation(copy, format, 'my-rule');

    expect(result).toEqual({
      heading: 'https://localhost/test',
      location: { type: 'custom', value: 'https://localhost/test' },
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

  it('returns thymianFormat edge location for a non-http-transaction edge, using edge label as heading', () => {
    const format = new ThymianFormat();
    const [, resId] = format.addHttpTransaction(
      minimalRequest,
      minimalResponse,
      'test-source',
    );
    // Add a second request node so we can create an http-link
    const req2Id = format.addRequest({
      ...minimalRequest,
      path: '/other',
      sourceName: 'test-source',
    });
    const linkId = format.addHttpLink(resId, req2Id, {
      sourceName: 'test-source',
    });

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
    expect(result.heading).toBe(format.getEdge(linkId)!.label);
    expect(result.heading).not.toBe(linkId);
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

  it('does not return file type for a node even when sourceLocation has a path', () => {
    const format = new ThymianFormat();
    const reqId = format.addRequest({
      ...minimalRequest,
      sourceName: 'test-source',
      sourceLocation: {
        path: '/some/spec.yaml',
        position: { line: 5, column: 0, offset: 0 },
      },
    });

    const result = resolveViolationLocation(
      { elementType: 'node', elementId: reqId },
      format,
      'my-rule',
    );

    expect(result.location).toMatchObject({
      type: 'thymianFormat',
      elementType: 'node',
      elementId: reqId,
    });
  });

  it('does not return file type for an http-transaction edge even when sourceLocation has a path', () => {
    const format = new ThymianFormat();
    const [, , transactionId] = format.addHttpTransaction(
      {
        ...minimalRequest,
        sourceLocation: {
          path: '/some/file.yaml',
          position: { line: 1, column: 0, offset: 0 },
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
