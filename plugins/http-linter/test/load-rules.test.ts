import { createRequire } from 'node:module';

import { describe, it, vitest } from 'vitest';

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
    const rules = await loadRules('@thymian/rfc-9110-rules');
  });
});
