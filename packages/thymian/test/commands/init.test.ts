import { join } from 'node:path';

import { captureOutput, runCommand } from '@oclif/test';
import { describe, it } from 'vitest';

process.env.OCLIF_TEST_ROOT = join(import.meta.url, '../../..');

describe('init command', () => {
  it('should run init command', async () => {
    await captureOutput(async () => await runCommand('init --no-input'));
  });
});
