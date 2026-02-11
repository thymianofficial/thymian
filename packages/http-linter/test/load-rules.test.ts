import { createRequire } from 'node:module';
import { join } from 'node:path';

import { describe, expect, it, vitest } from 'vitest';

import { loadRules } from '../src/load-rules.js';
vitest.mock('./import-meta-resolve.ts', () => ({
  importMetaResolve: vitest
    .fn()
    .mockImplementation(
      (specifier) =>
        `file://${createRequire(import.meta.url).resolve(specifier)}`,
    ),
}));

describe('load rules', () => {
  it('should load rules from package', async () => {
    await loadRules('@thymian/rfc-9110-rules');
  });

  it('overrides severity from config with object', async () => {
    const basePath = import.meta.dirname;

    const rules = await loadRules(
      ['a', 'b'].map((name) =>
        join(basePath, 'fixtures', 'rules', `${name}.rule.mjs`),
      ),
      () => true,
      {
        a: {
          severity: 'off',
        },
        b: {
          severity: 'hint',
        },
      },
    );

    expect(rules).toHaveLength(2);

    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({ severity: 'off', name: 'a' }),
        }),
        expect.objectContaining({
          meta: expect.objectContaining({ severity: 'hint', name: 'b' }),
        }),
      ]),
    );
  });

  it('overrides severity from config with string', async () => {
    const basePath = import.meta.dirname;

    const rules = await loadRules(
      ['a', 'b'].map((name) =>
        join(basePath, 'fixtures', 'rules', `${name}.rule.mjs`),
      ),
      () => true,
      {
        a: 'off',
        b: 'hint',
      },
    );

    expect(rules).toHaveLength(2);

    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({ severity: 'off', name: 'a' }),
        }),
        expect.objectContaining({
          meta: expect.objectContaining({ severity: 'hint', name: 'b' }),
        }),
      ]),
    );
  });

  it('overrides type from config', async () => {
    const basePath = import.meta.dirname;

    const rules = await loadRules(
      ['a', 'b'].map((name) =>
        join(basePath, 'fixtures', 'rules', `${name}.rule.mjs`),
      ),
      () => true,
      {
        a: {
          type: ['analytics'],
        },
      },
    );

    expect(rules).toHaveLength(2);

    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({ type: ['analytics'], name: 'a' }),
        }),
      ]),
    );
  });
});
