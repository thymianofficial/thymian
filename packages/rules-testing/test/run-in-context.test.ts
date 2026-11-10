import {
  type CapturedTransaction,
  constant,
  httpRule,
  type RuleFnResult,
  type RuleType,
  ThymianFormat,
} from '@thymian/core';
import { createThymianFormatWithTransaction } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import {
  type InputOf,
  runInContext,
  type ValidationContext,
  validationContexts,
} from '../src/index.js';
import { loadPlugin } from '../src/run-in-context.js';

const recorded: CapturedTransaction = {
  request: {
    data: {
      origin: 'https://api.example.com',
      path: '/',
      method: 'get',
      headers: {},
    },
    meta: { role: 'user-agent' },
  },
  response: {
    data: { statusCode: 200, headers: {}, trailers: {}, duration: 1 },
    meta: { role: 'origin server' },
  },
};

// One input per context, each holding exactly one transaction.
const inputs: { [C in ValidationContext]: InputOf<C> } = {
  static: { format: createThymianFormatWithTransaction() },
  test: {
    format: createThymianFormatWithTransaction(),
    runRequest: async () => ({
      statusCode: 200,
      headers: {},
      trailers: {},
      duration: 1,
    }),
  },
  analytics: { transactions: [recorded] },
};

// A rule that flags every transaction it sees, in every context.
function flagsEverything(
  severity: 'off' | 'error' = 'error',
  name = 'rules-testing/flags-everything',
) {
  return httpRule(name)
    .severity(severity)
    .type('static', 'test', 'analytics')
    .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
    .done();
}

const violations = (results: RuleFnResult[]) =>
  results.filter((result) => result.violation !== undefined);

describe('validationContexts', () => {
  it('are the rule types a rule can run in', () => {
    expect([...validationContexts].sort()).toEqual([
      'analytics',
      'static',
      'test',
    ]);
  });
});

describe('runInContext', () => {
  describe.each(validationContexts)('in %s', (context) => {
    it("runs the rule through the context's engine", async () => {
      const results = await runInContext(
        context,
        flagsEverything(),
        inputs[context],
      );

      expect(violations(results)).toHaveLength(1);
    });

    // `runRules` skips an `off` rule by design, so the harness must turn it on
    // or a convention rule's test would pass by never running.
    it('runs a rule shipped off at warn', async () => {
      const results = await runInContext(
        context,
        flagsEverything('off'),
        inputs[context],
      );

      expect(violations(results)).toHaveLength(1);
    });

    it("returns nothing for a rule configured 'off'", async () => {
      const results = await runInContext(context, flagsEverything(), {
        ...inputs[context],
        config: 'off',
      });

      expect(results).toEqual([]);
    });
  });

  // Carried over from the first rule set's harness: the one property no
  // fixture shows until a convention rule ships.
  it('runs a rule shipped off at warn over an empty description', async () => {
    const rule = httpRule('rules-testing/off-rule')
      .severity('off')
      .type('static')
      .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
      .done();

    const results = await runInContext('static', rule, {
      format: createThymianFormatWithTransaction(),
    });

    expect(violations(results)).toEqual([
      expect.objectContaining({ violation: {} }),
    ]);
  });

  describe('config', () => {
    it('lets an explicit severity win over the off-to-warn promotion', async () => {
      const results = await runInContext('static', flagsEverything('off'), {
        ...inputs.static,
        config: { severity: 'off' },
      });

      expect(results).toEqual([]);
    });

    it('runs a rule shipped off at the severity it is given', async () => {
      const results = await runInContext('static', flagsEverything('off'), {
        ...inputs.static,
        config: 'hint',
      });

      expect(violations(results)).toHaveLength(1);
    });

    it("passes the rule's options to it", async () => {
      const rule = httpRule('rules-testing/reads-options')
        .severity('error')
        .type('static')
        .rule((_ctx, options) =>
          options.flag === true
            ? [{ location: 'options', violation: {}, findings: [] }]
            : [],
        )
        .done();

      await expect(
        runInContext('static', rule, { format: new ThymianFormat() }),
      ).resolves.toEqual([]);
      await expect(
        runInContext('static', rule, {
          format: new ThymianFormat(),
          config: { options: { flag: true } },
        }),
      ).resolves.toHaveLength(1);
    });

    it('applies a type override, as a config file does', async () => {
      const narrowed: [RuleType] = ['test'];

      const results = await runInContext('static', flagsEverything(), {
        ...inputs.static,
        config: { type: narrowed },
      });

      expect(results).toEqual([]);
    });

    it("applies skipOrigins to the context's engine", async () => {
      const results = await runInContext('analytics', flagsEverything(), {
        ...inputs.analytics,
        config: { skipOrigins: ['https://api.example.com'] },
      });

      expect(violations(results)).toEqual([]);
    });
  });
});

describe('a context whose plugin is not installed', () => {
  // A package that cannot be installed: npm names are lowercase.
  const missing = '@thymian/Plugin-Not-Installed';

  it('rejects with an error naming the context and the package', async () => {
    await expect(
      loadPlugin('test', () => import(missing), missing),
    ).rejects.toThrow(new Error(`the \`test\` context needs \`${missing}\``));
  });

  it('passes any other failure through unchanged', async () => {
    const failure = new Error('the plugin broke while loading');

    await expect(
      loadPlugin('test', () => Promise.reject(failure), missing),
    ).rejects.toBe(failure);
  });
});
