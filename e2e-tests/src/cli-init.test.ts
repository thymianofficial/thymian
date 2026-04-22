import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { execThymian, useTempDir } from './helpers.js';

describe('thymian generate config', () => {
  const getTempDir = useTempDir();

  it('should generate a config file for a given spec', () => {
    const output = execThymian(
      [
        'generate',
        'config',
        '--no-interactive',
        '--for-spec',
        'openapi:petstore.yaml',
      ],
      { cwd: getTempDir() },
    );

    expect(output).toMatch(/Configuration written to/);

    const configPath = join(getTempDir(), 'thymian.config.yaml');
    expect(existsSync(configPath)).toBe(true);

    // Read and verify the raw config content
    const rawContent = readFileSync(configPath, 'utf-8');

    // Parse the YAML and verify config structure
    const config = parse(rawContent) as Record<string, unknown>;

    // Verify specifications
    expect(config.specifications).toEqual([
      { type: 'openapi', location: 'petstore.yaml' },
    ]);

    // Verify default ruleSets and severity
    expect(config.ruleSets).toEqual([
      '@thymian/rules-rfc-9110',
      '@thymian/rules-api-description-validation',
    ]);
    expect(config.ruleSeverity).toBe('error');
    expect(config.rules).toEqual({});

    // Verify traffic
    expect(config.traffic).toEqual([]);

    // Verify all default plugins are present
    const plugins = config.plugins as Record<string, unknown>;
    expect(plugins).toHaveProperty('@thymian/plugin-http-linter');
    expect(plugins).toHaveProperty('@thymian/plugin-openapi');
    expect(plugins).toHaveProperty('@thymian/plugin-request-dispatcher');
    expect(plugins).toHaveProperty('@thymian/plugin-sampler');
    expect(plugins).toHaveProperty('@thymian/plugin-reporter');
    expect(plugins).toHaveProperty('@thymian/plugin-http-tester');
    expect(plugins).toHaveProperty('@thymian/plugin-http-analyzer');

    expect(plugins['@thymian/plugin-reporter']).toEqual({
      options: { formatters: { text: {} } },
    });
  }, 90_000);
});
