// Runs as a plain `node` subprocess — no vitest, no monorepo workspace
// symlink. `@thymian/core` is resolved from this directory's own
// `node_modules`, installed from Verdaccio as a real npm package.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRules } from '@thymian/core';

const here = dirname(fileURLToPath(import.meta.url));
const rulePath = join(here, 'ts-rule.rule.ts');

const rules = await loadRules(rulePath);

if (rules.length !== 1 || rules[0]?.meta.name !== 'external-harness-ts-rule') {
  console.error('FAIL: unexpected rules result', JSON.stringify(rules));
  process.exit(1);
}

console.log(
  'PASS: loaded a .ts rule through the installed, built @thymian/core via jiti',
);
