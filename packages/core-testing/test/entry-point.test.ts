import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// Fails every resolution of `vitest`, as if it were not installed.
const withoutVitest = `data:text/javascript,${encodeURIComponent(`
  import { register } from 'node:module';
  register('data:text/javascript,' + encodeURIComponent(
    "export async function resolve(specifier, context, next) {" +
    "  if (specifier === 'vitest' || specifier.startsWith('vitest/')) throw new Error('vitest is not installed');" +
    "  return next(specifier, context);" +
    "}"
  ));
`)}`;

function importWithoutVitest(entry: string) {
  return spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--import',
      withoutVitest,
      '--input-type=module',
      '--eval',
      `await import(${JSON.stringify(entry)});`,
    ],
    { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' },
  );
}

describe('the root entry point', () => {
  it('loads without vitest installed', () => {
    const { status, stderr } = importWithoutVitest(
      new URL('../src/index.ts', import.meta.url).href,
    );

    expect(status, stderr).toBe(0);
  });
});

describe('the probe without vitest', () => {
  it('fails a module that imports vitest', () => {
    const { status, stderr } = importWithoutVitest(
      new URL('../src/rule-context-scenarios.ts', import.meta.url).href,
    );

    expect(stderr).toContain('vitest is not installed');
    expect(status).not.toBe(0);
  });
});
