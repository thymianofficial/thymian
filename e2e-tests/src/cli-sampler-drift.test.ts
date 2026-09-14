import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymian,
  execThymianRaw,
  fixturesDir,
  useTempDir,
} from './helpers.js';

const GENERATED = join('.thymian', 'sampler', 'generated');

describe('thymian sampler init, sync and validate', () => {
  const getTempDir = useTempDir();

  function setUp(): string {
    const dir = getTempDir();

    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), dir);

    return dir;
  }

  it('init scaffolds the surface, and a clean tree is in sync', () => {
    const dir = setUp();

    const output = execThymian(['sampler', 'init'], { cwd: dir });

    expect(output).toContain('Sampler ready');
    expect(output).toContain('"exclude"');
    expect(existsSync(join(dir, GENERATED, 'request-types.d.ts'))).toBe(true);
    expect(existsSync(join(dir, GENERATED, 'hooks-api.d.ts'))).toBe(true);
    expect(existsSync(join(dir, '.thymian', 'sampler', 'tsconfig.json'))).toBe(
      true,
    );

    const check = execThymianRaw(['sampler', 'sync', '--check'], { cwd: dir });

    expect(check.exitCode).toBe(0);
    expect(check.output).toContain('match this API description');
  }, 180_000);

  it('regenerating from nothing reproduces the committed surface byte for byte', () => {
    const dir = setUp();

    execThymian(['sampler', 'init'], { cwd: dir });

    const before = readFileSync(
      join(dir, GENERATED, 'request-types.d.ts'),
      'utf-8',
    );

    execThymian(['sampler', 'sync'], { cwd: dir });

    expect(
      readFileSync(join(dir, GENERATED, 'request-types.d.ts'), 'utf-8'),
    ).toBe(before);
  }, 180_000);

  it('sync --check fails when the description has moved, and writes nothing', () => {
    const dir = setUp();

    execThymian(['sampler', 'init'], { cwd: dir });

    const specPath = join(dir, 'test.openapi.yaml');
    const spec = readFileSync(specPath, 'utf-8');

    // An added status: additive, so no hook can break — but the committed
    // types no longer describe the API.
    const added = spec.replace(
      "        '200':\n",
      "        '503':\n          description: 'Temporarily unavailable'\n        '200':\n",
    );

    expect(added, 'the fixture shape the edit relies on').not.toBe(spec);
    writeFileSync(specPath, added, 'utf-8');

    const before = readFileSync(
      join(dir, GENERATED, 'request-types.d.ts'),
      'utf-8',
    );
    const check = execThymianRaw(['sampler', 'sync', '--check'], {
      cwd: dir,
      allowFailure: true,
    });

    expect(check.exitCode).not.toBe(0);
    expect(check.output).toContain('out of sync');
    expect(
      readFileSync(join(dir, GENERATED, 'request-types.d.ts'), 'utf-8'),
    ).toBe(before);

    // And it is only a warning for the hooks, not a failure.
    const validate = execThymianRaw(['sampler', 'validate'], { cwd: dir });

    expect(validate.exitCode).toBe(0);
    expect(validate.output).toContain('behind this API description');

    // After sync, both are quiet again.
    execThymian(['sampler', 'sync'], { cwd: dir });

    expect(
      execThymianRaw(['sampler', 'sync', '--check'], { cwd: dir }).exitCode,
    ).toBe(0);
  }, 180_000);

  it('validate calls a stale hook broken, not drifted, when nothing moved', () => {
    const dir = setUp();

    execThymian(['sampler', 'init'], { cwd: dir });

    const hooksDir = join(dir, '.thymian', 'sampler', 'hooks');

    writeFileSync(
      join(hooksDir, 'stale.ts'),
      `import { beforeEach } from '@thymian/hooks';

export const stale = beforeEach(
  'GET /api/hello -> 418 (application/json)',
  () => {},
);
`,
      'utf-8',
    );

    const result = execThymianRaw(['sampler', 'validate'], {
      cwd: dir,
      allowFailure: true,
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('stale.ts');
    // The description has not moved and the committed types are in sync, so
    // this is a hook that does not compile — not drift, and `sync` would
    // rewrite correct files while leaving the real error in place.
    expect(result.output).toContain('do not compile');
    expect(result.output).not.toContain('Breaking drift');
  }, 180_000);

  it('validate calls it drift when the description moved under the hook', () => {
    const dir = setUp();

    execThymian(['sampler', 'init'], { cwd: dir });

    const hooksDir = join(dir, '.thymian', 'sampler', 'hooks');

    writeFileSync(
      join(hooksDir, 'hook.ts'),
      `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach(
  'GET /api/hello -> 200 (application/json)',
  () => {},
);
`,
      'utf-8',
    );

    // Rename the path the hook is anchored to: the surface moves *and* the
    // hook stops fitting, which is drift proper.
    const specPath = join(dir, 'test.openapi.yaml');
    const spec = readFileSync(specPath, 'utf-8');
    const renamed = spec.replace('/api/hello:', '/api/greeting:');

    expect(renamed, 'the fixture path the edit relies on').not.toBe(spec);
    writeFileSync(specPath, renamed, 'utf-8');

    const result = execThymianRaw(['sampler', 'validate'], {
      cwd: dir,
      allowFailure: true,
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('Breaking drift');
    expect(result.output).toContain('sampler sync');
  }, 180_000);
});
