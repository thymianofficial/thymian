import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import hook from '../src/cli/spec-search-hook.js';
import { openApiPlugin } from '../src/index.js';

describe('spec-search-hook', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'thymian-hook-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should return discovered specification files as SpecificationInput[]', async () => {
    await writeFile(
      join(tempDir, 'openapi.yaml'),
      'openapi: 3.0.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
    );

    const result = await hook({ cwd: tempDir });

    expect(result).toEqual({
      pluginName: openApiPlugin.name,
      specifications: [{ type: 'openapi', location: 'openapi.yaml' }],
    });
  });

  it('should return empty specifications when no files found', async () => {
    const result = await hook({ cwd: tempDir });

    expect(result).toEqual({
      pluginName: openApiPlugin.name,
      specifications: [],
    });
  });

  it('should return the openapi plugin name', async () => {
    const result = await hook({ cwd: tempDir });

    expect(result.pluginName).toBe('@thymian/openapi');
  });
});
