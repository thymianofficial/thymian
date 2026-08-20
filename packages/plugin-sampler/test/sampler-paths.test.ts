import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveSamplerPaths } from '../src/sampler-paths.js';

describe('resolveSamplerPaths', () => {
  it('derives every v2 sampler path from the one root', () => {
    const paths = resolveSamplerPaths('/workspace');

    expect(paths.root).toBe(join('/workspace', '.thymian', 'sampler'));
    expect(paths.hooksDir).toBe(join(paths.root, 'hooks'));
    expect(paths.generatedDir).toBe(join(paths.root, 'generated'));
    expect(paths.tsconfigPath).toBe(join(paths.root, 'tsconfig.json'));
  });

  it('keeps the v2 root separate from the v1 samples tree', () => {
    // `SamplerPluginOptions.path` still means `.thymian/samples`, which
    // `sampler.path-from-transaction`, `sampler init` and `sampler validate`
    // depend on until 575.10. The two roots must not collide.
    const paths = resolveSamplerPaths('/workspace');

    expect(paths.root).not.toBe(join('/workspace', '.thymian', 'samples'));
    expect(paths.hooksDir.includes(`${'samples'}`)).toBe(false);
  });

  it('is a pure function of cwd', () => {
    expect(resolveSamplerPaths('/a')).toEqual(resolveSamplerPaths('/a'));
    expect(resolveSamplerPaths('/a')).not.toEqual(resolveSamplerPaths('/b'));
  });
});
