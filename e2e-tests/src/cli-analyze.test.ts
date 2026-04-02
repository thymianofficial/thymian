import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  fixturesDir,
  spawnThymian,
  useTempDir,
  writeConfigToTempDir,
} from './helpers.js';

describe('thymian analyze', () => {
  const getTempDir = useTempDir();

  describe('guidance messages', () => {
    it('should exit 2 and guide when no traffic is configured', () => {
      writeConfigToTempDir(
        getTempDir(),
        [
          'plugins:',
          "  '@thymian/http-analyzer': {}",
          "  '@thymian/reporter':",
          '    options:',
          '      formatters:',
          '        text: {}',
        ].join('\n'),
      );

      const result = spawnThymian(['analyze'], { cwd: getTempDir() });

      expect(result.status).toBe(2);
      expect(result.output).toMatch(/No traffic found|No traffic configured/);
    }, 90_000);

    it('should not require a specification to run', () => {
      copyFixturesToTempDir(join(fixturesDir, 'analyze'), getTempDir());

      // The analyze fixture has traffic but no specifications configured.
      // The command must not exit 2 with a "No specification" guidance.
      const result = spawnThymian(['analyze'], { cwd: getTempDir() });

      expect(result.output).not.toMatch(/No specification found/);
      expect(result.output).not.toMatch(/No specification configured/);
      expect(result.status).not.toBe(2);
    }, 90_000);
  });

  describe('analyze with traffic loader plugin', () => {
    it('should detect rule violations and exit 1', () => {
      copyFixturesToTempDir(join(fixturesDir, 'analyze'), getTempDir());

      const result = spawnThymian(['analyze'], { cwd: getTempDir() });

      // The fixture plugin provides a GET 200 response without ETag or
      // Last-Modified, which violates the should-send-validator-fields
      // rule. The analyzer must report findings and exit 1.
      expect(result.status).toBe(1);
    }, 90_000);

    it('should report rule violations with severity and rule name', () => {
      copyFixturesToTempDir(join(fixturesDir, 'analyze'), getTempDir());

      const result = spawnThymian(['analyze'], { cwd: getTempDir() });

      expect(result.stdout).toMatch(/reported a violation/);
      expect(result.stdout).toMatch(/warn/);
    }, 90_000);

    it('should include a summary footer with error, warning and hint counts', () => {
      copyFixturesToTempDir(join(fixturesDir, 'analyze'), getTempDir());

      const result = spawnThymian(['analyze'], { cwd: getTempDir() });

      // The text formatter always outputs a summary line like:
      // "Found 0 errors, 1 warnings and 0 hints."
      expect(result.stdout).toMatch(
        /Found \d+ errors?, \d+ warnings? and \d+ hints?/,
      );
    }, 90_000);
  });

  describe('stream separation', () => {
    it('should write report output to stdout, not stderr', () => {
      copyFixturesToTempDir(join(fixturesDir, 'analyze'), getTempDir());

      const result = spawnThymian(['analyze'], { cwd: getTempDir() });

      // Report text (rule violations, severity, summary) belongs on stdout.
      expect(result.stdout).toMatch(/rules run successfully/);

      // stderr must not contain report content.
      expect(result.stderr).not.toMatch(/rules run successfully/);
      expect(result.stderr).not.toMatch(/reported a violation/);
    }, 90_000);
  });

  describe('clean traffic (no violations)', () => {
    it('should exit 0 and show no-violations message for conformant traffic', () => {
      // Use a config that references the clean traffic loader plugin where
      // every response includes proper validator fields (ETag).
      writeConfigToTempDir(
        getTempDir(),
        [
          'traffic:',
          '  - type: fixture',
          '    location: static',
          'ruleSets:',
          "  - '@thymian/rfc-9110-rules'",
          'plugins:',
          "  '@thymian/http-analyzer': {}",
          "  '@thymian/e2e-clean-traffic-loader':",
          '    path: ./clean-traffic-loader-plugin.mjs',
          "  '@thymian/reporter':",
          '    options:',
          '      formatters:',
          '        text: {}',
        ].join('\n'),
      );
      copyFixturesToTempDir(join(fixturesDir, 'analyze'), getTempDir());

      const result = spawnThymian(['analyze'], { cwd: getTempDir() });

      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/No violations found/);
    }, 90_000);
  });

  describe('invalid specification', () => {
    it('should exit 2 when the specification cannot be parsed', () => {
      copyFixturesToTempDir(join(fixturesDir, 'analyze'), getTempDir());

      // Pass an unparseable spec file via --spec flag.
      const result = spawnThymian(
        ['analyze', '--spec', 'openapi:invalid-spec.yaml'],
        { cwd: getTempDir() },
      );

      expect(result.status).toBe(2);
    }, 90_000);
  });

  describe('--spec flag (zero-config entry)', () => {
    it('should accept --spec flag and run the same core workflow path', () => {
      copyFixturesToTempDir(join(fixturesDir, 'analyze'), getTempDir());

      // Copy the lint fixture's valid OpenAPI spec into the temp dir so
      // --spec can reference it. The analyze workflow optionally loads a
      // spec when provided.
      copyFixturesToTempDir(join(fixturesDir, 'static-lint'), getTempDir());

      const result = spawnThymian(
        ['analyze', '--spec', 'openapi:test.openapi.yaml'],
        { cwd: getTempDir() },
      );

      // The command should complete (exit 0 or 1) — NOT exit 2 with a
      // guidance/error about the spec.
      expect(result.status).not.toBe(2);
      expect(result.stdout).toMatch(/rules run successfully/);
    }, 90_000);
  });
});
