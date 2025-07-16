import { join } from 'node:path';

import { captureOutput } from '@oclif/test';
import { describe, it } from 'vitest';

import Init from '../../src/commands/init.js';

process.env.OCLIF_TEST_ROOT = join(import.meta.url, '../../..');

describe('init command', () => {
  it('should run init command', async () => {
    await captureOutput(async () => Init.run());
  });
});
