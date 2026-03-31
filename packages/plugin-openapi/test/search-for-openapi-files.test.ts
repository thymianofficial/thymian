import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { searchForOpenApiFiles } from '../src/search-for-openapi-files.js';

describe('searchForOpenApiFiles', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'thymian-spec-search-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should find OpenAPI v3.0 YAML files', async () => {
    await writeFile(
      join(tempDir, 'openapi.yaml'),
      'openapi: 3.0.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
    );

    const result = await searchForOpenApiFiles(tempDir);

    expect(result).toEqual(['openapi.yaml']);
  });

  it('should find OpenAPI v3.1 YAML files', async () => {
    await writeFile(
      join(tempDir, 'api.yml'),
      'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
    );

    const result = await searchForOpenApiFiles(tempDir);

    expect(result).toEqual(['api.yml']);
  });

  it('should find Swagger v2 YAML files', async () => {
    await writeFile(
      join(tempDir, 'swagger.yaml'),
      'swagger: 2.0.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
    );

    const result = await searchForOpenApiFiles(tempDir);

    expect(result).toEqual(['swagger.yaml']);
  });

  it('should find OpenAPI v3 JSON files', async () => {
    await writeFile(
      join(tempDir, 'openapi.json'),
      '{\n  "openapi": "3.0.0",\n  "info": { "title": "Test", "version": "1.0.0" },\n  "paths": {}\n}',
    );

    const result = await searchForOpenApiFiles(tempDir);

    expect(result).toEqual(['openapi.json']);
  });

  it('should find multiple specification files', async () => {
    await writeFile(
      join(tempDir, 'api-a.yaml'),
      'openapi: 3.0.0\ninfo:\n  title: A\n  version: 1.0.0\npaths: {}\n',
    );
    await writeFile(
      join(tempDir, 'api-b.yaml'),
      'openapi: 3.1.0\ninfo:\n  title: B\n  version: 1.0.0\npaths: {}\n',
    );

    const result = await searchForOpenApiFiles(tempDir);

    expect(result).toHaveLength(2);
    expect(result).toContain('api-a.yaml');
    expect(result).toContain('api-b.yaml');
  });

  it('should find specification files in subdirectories', async () => {
    await mkdir(join(tempDir, 'specs'), { recursive: true });
    await writeFile(
      join(tempDir, 'specs', 'petstore.yaml'),
      'openapi: 3.0.0\ninfo:\n  title: Petstore\n  version: 1.0.0\npaths: {}\n',
    );

    const result = await searchForOpenApiFiles(tempDir);

    expect(result).toHaveLength(1);
    expect(result[0]).toContain('specs/');
  });

  it('should return empty array when no specification files exist', async () => {
    const result = await searchForOpenApiFiles(tempDir);

    expect(result).toEqual([]);
  });

  it('should ignore non-specification YAML/JSON files', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      '{ "name": "test", "version": "1.0.0" }\n',
    );
    await writeFile(
      join(tempDir, 'config.yaml'),
      'database:\n  host: localhost\n  port: 5432\n',
    );

    const result = await searchForOpenApiFiles(tempDir);

    expect(result).toEqual([]);
  });

  it('should return empty array for an empty directory', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'thymian-empty-'));

    try {
      const result = await searchForOpenApiFiles(emptyDir);

      expect(result).toEqual([]);
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });
});
