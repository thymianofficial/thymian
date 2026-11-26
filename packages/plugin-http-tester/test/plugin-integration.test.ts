import { httpRule, statusCode, Thymian, ThymianFormat } from '@thymian/core';
import {
  createCreatedResponse,
  createPostRequest,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import httpTesterPlugin from '../src/index.js';

describe('plugin-http-tester integration', () => {
  it('returns tool runs from core.test', async () => {
    const thymian = new Thymian();
    await thymian.register(httpTesterPlugin, {}).ready();

    const runs = await thymian.emitter.emitAction(
      'core.test',
      {
        format: new ThymianFormat().export(),
        rules: [],
        rulesConfig: {},
      },
      { strategy: 'first' },
    );

    expect(runs).toHaveLength(1);
    expect(runs[0]?.tool.name).toBe('@thymian/plugin-http-tester');
    expect(runs[0]?.executions).toHaveLength(0);

    await thymian.close();
  });

  it('populates ToolRun.rules from the executed rules', async () => {
    const thymian = new Thymian();
    await thymian.register(httpTesterPlugin, {}).ready();

    const rule = httpRule('test/example-rule')
      .severity('warn')
      .type('test')
      .summary('Example rule summary')
      .rule(() => [
        {
          location: 'example',
          violation: { message: 'violation' },
          findings: [],
        },
      ])
      .done();

    const runs = await thymian.emitter.emitAction(
      'core.test',
      {
        format: new ThymianFormat().export(),
        rules: [rule],
        rulesConfig: {},
      },
      { strategy: 'first' },
    );

    expect(runs).toHaveLength(1);
    expect(runs[0]?.rules).toEqual([
      {
        id: 'test/example-rule',
        severity: 'warn',
        // done() mirrors a lone summary into description
        description: { text: 'Example rule summary' },
        summary: { text: 'Example rule summary' },
      },
    ]);

    await thymian.close();
  });

  describe('a rule that applies to nothing (ADR-0030)', () => {
    const rule = httpRule('test/created-only')
      .severity('error')
      .type('test')
      .rule((ctx) =>
        ctx.validateCommonHttpTransactions({
          appliesTo: statusCode(201),
          violatedWhen: () => [],
        }),
      )
      .done();

    async function runOn(
      format: ThymianFormat,
      rulesConfig: Record<string, unknown> = {},
    ) {
      const thymian = new Thymian();
      await thymian.register(httpTesterPlugin, {}).ready();
      try {
        const [run] = await thymian.emitter.emitAction(
          'core.test',
          { format: format.export(), rules: [rule], rulesConfig },
          { strategy: 'first' },
        );
        return run?.executions ?? [];
      } finally {
        await thymian.close();
      }
    }

    it('appears in the report as one notApplicable execution', async () => {
      const executions = await runOn(new ThymianFormat());

      expect(executions).toEqual([
        expect.objectContaining({
          ruleId: 'test/created-only',
          status: {
            kind: 'notApplicable',
            reason: 'The input has no transaction this rule applies to.',
          },
          steps: [],
        }),
      ]);
    });

    it('says when skipOrigins excluded every transaction it applies to', async () => {
      const format = createThymianFormatWithTransactions([
        [
          createPostRequest({ path: '/launches', host: 'example.com' }),
          createCreatedResponse(),
        ],
      ]);

      const executions = await runOn(format, {
        'test/created-only': { skipOrigins: ['https://example.com'] },
      });

      expect(executions.map(({ status }) => status)).toEqual([
        {
          kind: 'notApplicable',
          reason:
            'skipOrigins excluded every transaction this rule applies to.',
        },
      ]);
    });
  });
});
