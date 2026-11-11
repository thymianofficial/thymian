import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

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

it('loads without vitest installed', () => {
  const entry = new URL('../src/index.ts', import.meta.url).href;

  const { status, stderr } = spawnSync(
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

  expect(status, stderr).toBe(0);
});
