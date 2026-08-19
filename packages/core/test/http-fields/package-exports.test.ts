import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import packageJson from '../../package.json' with { type: 'json' };
import { fromRuntimeHeaders } from '../../src/index.js';

// `nx run core:build` must run before this test for the dist assertions
// below to pass (see spec Design Notes: this replaces a package-name-import
// test with an assertion on the exports map + built output, since no
// existing fixture convention covers a same-package subpath import).
const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

describe('@thymian/core package exports (AC 1: ./http-fields subpath)', () => {
  it('declares "./http-fields" in the exports map as a plain string, like "./utils"/"./http-filter"', () => {
    const exportsMap = packageJson.exports as Record<string, unknown>;

    expect(exportsMap['./http-fields']).toBe('./dist/http-fields/index.js');
    expect(typeof exportsMap['./utils']).toBe('string');
    expect(typeof exportsMap['./http-filter']).toBe('string');
  });

  it('builds the ./http-fields subpath target and its type declarations', () => {
    expect(existsSync(resolve(packageRoot, 'dist/http-fields/index.js'))).toBe(
      true,
    );
    expect(
      existsSync(resolve(packageRoot, 'dist/http-fields/index.d.ts')),
    ).toBe(true);
  });

  it('re-exports http-fields from the root barrel, like every other subpath', () => {
    expect(typeof fromRuntimeHeaders).toBe('function');
  });
});

describe('@thymian/core package.json dependencies (AC 4)', () => {
  it('adds no new dependency -- structured-headers stays deferred to story 643.2', () => {
    expect(packageJson.dependencies).not.toHaveProperty('structured-headers');
    expect(packageJson.devDependencies).not.toHaveProperty(
      'structured-headers',
    );
  });
});
