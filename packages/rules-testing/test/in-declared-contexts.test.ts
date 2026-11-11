import { constant, type ExecutableRuleType, httpRule } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import {
  checkInput,
  inDeclaredContexts,
  type ObservedInput,
  validationContexts,
} from '../src/index.js';

function declaring(...types: ExecutableRuleType[]) {
  return httpRule('rules-testing/flags-everything')
    .severity('error')
    .type(...types)
    .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
    .done();
}

function observedAt(path: string): ObservedInput {
  return {
    observed: [
      {
        described: {
          request: createHttpRequest({ host: 'api.example.com', path }),
          response: createHttpResponse(),
        },
      },
    ],
  };
}

const violates = observedAt('/violates');
const conforms = observedAt('/conforms');
const skips = observedAt('/skips');

describe('inDeclaredContexts', () => {
  it('gives a rule declaring every context one fixture per context', () => {
    const rule = declaring('static', 'test', 'analytics');

    expect(inDeclaredContexts(rule, { violates, conforms })).toEqual({
      rule,
      static: { violates, conforms },
      test: { violates, conforms },
      analytics: { violates, conforms },
    });
  });

  it.each([
    [['static'] as const],
    [['test', 'analytics'] as const],
    [['static', 'analytics'] as const],
  ])('gives a rule declaring %j only those contexts', (types) => {
    const fixtures = inDeclaredContexts(declaring(...types), {
      violates,
      conforms,
    });

    expect(
      validationContexts.filter((context) => context in fixtures).sort(),
    ).toEqual([...types].sort());
  });

  it('ignores the informational type, which is no context', () => {
    const informational = httpRule('rules-testing/informational')
      .severity('hint')
      .type('informational')
      .done();
    const fixtures = inDeclaredContexts(informational, { violates, conforms });

    expect(Object.keys(fixtures)).toEqual(['rule']);
  });

  it('carries skips into every context when given', () => {
    const fixtures = inDeclaredContexts(
      declaring('static', 'test', 'analytics'),
      { violates, conforms, skips },
    );

    for (const context of validationContexts) {
      expect(fixtures[context]).toEqual({ violates, conforms, skips });
    }
  });

  it.each([
    ['left out', { violates, conforms }],
    ['undefined', { violates, conforms, skips: undefined }],
  ])('leaves skips out when %s', (_how, inputs) => {
    const fixtures = inDeclaredContexts(declaring('static', 'test'), inputs);

    expect(fixtures.static).not.toHaveProperty('skips');
    expect(fixtures.test).not.toHaveProperty('skips');
  });

  it('lets one context be overridden by spreading', () => {
    const rule = declaring('static', 'test', 'analytics');
    const fixtures = {
      ...inDeclaredContexts(rule, { violates, conforms }),
      static: { violates: conforms, conforms: violates },
    };

    expect(fixtures.static).toEqual({ violates: conforms, conforms: violates });
    expect(fixtures.test).toEqual({ violates, conforms });
    expect(fixtures.analytics).toEqual({ violates, conforms });
  });

  it('builds inputs every declared context runs', async () => {
    const rule = declaring('static', 'test', 'analytics');
    const fixtures = inDeclaredContexts(rule, { violates, conforms });

    for (const context of validationContexts) {
      const input = fixtures[context]?.violates;
      if (input === undefined) {
        throw new Error(`no \`${context}\` fixture`);
      }
      const verdict = await checkInput(context, rule, input, 'violates');
      expect(verdict.met, verdict.reason).toBe(true);
    }
  });
});
