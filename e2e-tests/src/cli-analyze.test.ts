import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymian,
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
});
