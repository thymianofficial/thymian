import { join } from 'node:path';

import { captureOutput } from '@oclif/test';
import { describe, it } from 'vitest';

import LintCommand from '../../src/cli/commands/http-linter/lint.js';

process.env.OCLIF_TEST_ROOT = join(import.meta.url, '../../..');

describe('lint command', () => {
  it('should run lint command', async () => {
    const { stdout } = await captureOutput(async () => LintCommand.run());

    console.log(stdout);
  });
});
