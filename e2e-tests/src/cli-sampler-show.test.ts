import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymian,
  execThymianRaw,
  fixturesDir,
  useTempDir,
} from './helpers.js';

describe('thymian sampler show', () => {
  const getTempDir = useTempDir();

  it('prints the freshly generated request for a selector', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());

    const output = execThymian(
      ['sampler', 'show', 'GET /api/hello -> 200 (application/json)'],
      { cwd: getTempDir() },
    );

    expect(output).toContain('GET /api/hello -> 200 (application/json)');
    expect(output).toContain('"path": "/api/hello"');
    expect(output).toContain('"accept": "application/json"');
    // Nothing is materialized to show a request.
    expect(existsSync(join(getTempDir(), '.thymian'))).toBe(false);
  }, 180_000);

  it('emits the request as JSON', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());

    const output = execThymian(
      ['sampler', 'show', 'GET /api/hello -> 200 (application/json)', '--json'],
      { cwd: getTempDir() },
    );

    const shown = JSON.parse(output) as {
      selector: string;
      request: { method: string; path: string };
    };

    expect(shown.selector).toBe('GET /api/hello -> 200 (application/json)');
    expect(shown.request.method.toUpperCase()).toBe('GET');
    expect(shown.request.path).toBe('/api/hello');
  }, 180_000);

  it('fails with nearest-match suggestions for an unknown selector', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());

    const result = execThymianRaw(
      ['sampler', 'show', 'GET /api/hello -> 418 (application/json)'],
      { cwd: getTempDir(), allowFailure: true },
    );

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('No transaction matches the selector');
    expect(result.output).toContain('Did you mean one of these selectors?');
  }, 180_000);

  it('fails with the grammar for a malformed selector', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());

    const result = execThymianRaw(['sampler', 'show', 'GET /api/hello'], {
      cwd: getTempDir(),
      allowFailure: true,
    });

    expect(result.exitCode).not.toBe(0);
    // The CLI wraps long lines, so assert on a fragment that cannot straddle a
    // line break rather than on the whole sentence.
    expect(result.output).toContain('is not a valid transaction');
    expect(result.output).toContain('Write a selector as METHOD');
  }, 180_000);
});
