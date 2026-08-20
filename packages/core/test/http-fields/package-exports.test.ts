import { describe, expect, it } from 'vitest';

import packageJson from '../../package.json' with { type: 'json' };
import { fromRuntimeHeaders } from '../../src/index.js';

// This asserts only the exports map + a source-level re-export -- neither
// needs `dist/` to exist, so the test is self-contained. `nx run core:build`
// remains the thing that actually validates the built `dist/http-fields/`
// output (js + d.ts); duplicating that here would make this suite depend on
// build ordering (`nx test core` has no `dependsOn: ['build']`), which is
// brittle on a clean workspace/CI run where `dist/` isn't present yet.
describe('@thymian/core package exports (./http-fields subpath)', () => {
  it('declares "./http-fields" in the exports map as a plain string, like "./utils"/"./http-filter"', () => {
    const exportsMap = packageJson.exports as Record<string, unknown>;

    expect(exportsMap['./http-fields']).toBe('./dist/http-fields/index.js');
    expect(typeof exportsMap['./utils']).toBe('string');
    expect(typeof exportsMap['./http-filter']).toBe('string');
  });

  it('re-exports http-fields from the root barrel, like every other subpath', () => {
    expect(typeof fromRuntimeHeaders).toBe('function');
  });
});

describe('@thymian/core package.json dependencies', () => {
  it('adds structured-headers as a runtime dependency, not a dev dependency', () => {
    expect(packageJson.dependencies).toHaveProperty(
      'structured-headers',
      '^2.0.3',
    );
    expect(packageJson.devDependencies).not.toHaveProperty(
      'structured-headers',
    );
  });
});
