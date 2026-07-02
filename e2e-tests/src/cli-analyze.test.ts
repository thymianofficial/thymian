import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymianRaw,
  fixturesDir,
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
          "  '@thymian/plugin-http-analyzer': {}",
          "  '@thymian/plugin-reporter':",
          '    options:',
          '      formatters:',
          '        markdown: {}',
        ].join('\n'),
      );

      const result = execThymianRaw(['analyze'], {
        cwd: getTempDir(),
        allowFailure: true,
      });

      expect(result.exitCode).toBe(2);
      expect(result.output).toMatch(/No traffic found|No traffic configured/);
    }, 90_000);

    it('should not require a specification to run', () => {
      copyFixturesToTempDir(join(fixturesDir, 'analyze'), getTempDir());

      // The analyze fixture has traffic but no specifications configured.
      // The command must not exit 2 with a "No specification" guidance.
      const result = execThymianRaw(['analyze'], {
        cwd: getTempDir(),
        allowFailure: true,
      });

      expect(result.output).not.toMatch(/No specification found/);
      expect(result.output).not.toMatch(/No specification configured/);
      expect(result.exitCode).not.toBe(2);
    }, 90_000);
  });

  describe('analyze with traffic loader plugin', () => {
    it('should detect rule violations and exit 1', () => {
      copyFixturesToTempDir(join(fixturesDir, 'analyze'), getTempDir());

      const result = execThymianRaw(['analyze'], {
        cwd: getTempDir(),
        allowFailure: true,
      });

      // The fixture plugin provides a GET 200 response without ETag or
      // Last-Modified, which violates the should-send-validator-fields
      // rule. The analyzer must report findings and exit 1.
      expect(result.exitCode).toBe(1);
    }, 90_000);

    it('should report rule violations with rule names in the rendered output', () => {
      copyFixturesToTempDir(join(fixturesDir, 'analyze'), getTempDir());

      const result = execThymianRaw(['analyze'], {
        cwd: getTempDir(),
        allowFailure: true,
      });

      expect(result.stdout).toContain('@thymian/plugin-http-analyzer');
      expect(result.stdout).toContain(
        'rfc9110/origin-server-with-clock-must-generate-date-for-2xx-3xx-4xx',
      );
    }, 90_000);

    it('should include a summary footer with error, warning and hint counts', () => {
      copyFixturesToTempDir(join(fixturesDir, 'analyze'), getTempDir());

      const result = execThymianRaw(['analyze'], {
        cwd: getTempDir(),
        allowFailure: true,
      });

      expect(result.stdout).toMatch(
        /Summary: \d+ error\(s\), \d+ warning\(s\), \d+ hint\(s\), \d+ info finding\(s\)\./,
      );
    }, 90_000);
  });

  describe('stream separation', () => {
    it('should write report output to stdout, not stderr', () => {
      copyFixturesToTempDir(join(fixturesDir, 'analyze'), getTempDir());

      const result = execThymianRaw(['analyze'], {
        cwd: getTempDir(),
        allowFailure: true,
      });

      expect(result.stdout).toContain('Summary:');
      expect(result.stderr).not.toContain('Summary:');
      expect(result.stderr).not.toContain(
        'rfc9110/origin-server-with-clock-must-generate-date-for-2xx-3xx-4xx',
      );
    }, 90_000);
  });

  describe('clean traffic (no violations)', () => {
    it('should exit 0 when all traffic conforms to rules', () => {
      // Copy fixture files first (clean traffic loader plugin lives here)
      copyFixturesToTempDir(join(fixturesDir, 'analyze'), getTempDir());

      // Overwrite the config to reference the clean traffic loader that
      // includes proper validator fields (ETag) on every response.
      writeConfigToTempDir(
        getTempDir(),
        [
          'traffic:',
          '  - type: fixture',
          '    location: static',
          'ruleSets:',
          "  - '@thymian/rules-rfc-9110'",
          'plugins:',
          "  '@thymian/plugin-http-analyzer': {}",
          "  '@thymian/e2e-clean-traffic-loader':",
          '    path: ./clean-traffic-loader-plugin.mjs',
          "  '@thymian/plugin-reporter':",
          '    options:',
          '      formatters:',
          '        markdown: {}',
        ].join('\n'),
      );

      const result = execThymianRaw(['analyze'], { cwd: getTempDir() });

      // Exit 0 = clean-run (no violations)
      expect(result.exitCode).toBe(0);

      // The markdown formatter actually ran and wrote its default report.
      expect(existsSync(join(getTempDir(), '.thymian/reports/report.md'))).toBe(
        true,
      );
    }, 90_000);
  });

  describe('--spec flag (zero-config entry)', () => {
    it('should accept --spec flag and run the same core workflow path', () => {
      copyFixturesToTempDir(join(fixturesDir, 'analyze'), getTempDir());

      // Copy the lint fixture's valid OpenAPI spec into the temp dir so
      // --spec can reference it. Copy it AFTER the analyze fixtures so
      // the analyze thymian.config.yaml (with traffic loader) is preserved.
      cpSync(
        join(fixturesDir, 'static-lint', 'test.openapi.yaml'),
        join(getTempDir(), 'test.openapi.yaml'),
      );

      const result = execThymianRaw(
        ['analyze', '--spec', 'openapi:test.openapi.yaml'],
        { cwd: getTempDir(), allowFailure: true },
      );

      expect(result.exitCode).not.toBe(2);
      expect(result.stdout).toContain('@thymian/plugin-http-analyzer');
      expect(result.stdout).toContain('Summary:');
    }, 90_000);
  });
});
