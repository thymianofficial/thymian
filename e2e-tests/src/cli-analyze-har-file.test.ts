import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymianRaw,
  fixturesDir,
  useTempDir,
  writeConfigToTempDir,
} from './helpers.js';

describe('thymian analyze with HAR file', () => {
  const getTempDir = useTempDir();

  it('should load transactions from a HAR file and detect rule violations', () => {
    copyFixturesToTempDir(join(fixturesDir, 'analyze-har'), getTempDir());

    writeConfigToTempDir(
      getTempDir(),
      [
        'ruleSets:',
        "  - '@thymian/rules-rfc-9110'",
        'plugins:',
        "  '@thymian/plugin-har': {}",
        "  '@thymian/plugin-http-analyzer': {}",
        "  '@thymian/plugin-reporter':",
        '    options:',
        '      formatters:',
        '        text: {}',
      ].join('\n'),
    );

    // The first GET 200 response has no ETag or Last-Modified,
    // which should trigger the rfc9110 should-send-validator-fields rule.
    const result = execThymianRaw(['analyze', '--traffic', 'har:traffic.har'], {
      cwd: getTempDir(),
      allowFailure: true,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/reported a violation/);
    expect(result.stdout).toMatch(
      /Found \d+ errors?, \d+ warnings? and \d+ hints?/,
    );
  }, 90_000);

  it('should exit 0 when all HAR traffic conforms to rules', () => {
    copyFixturesToTempDir(join(fixturesDir, 'analyze-har'), getTempDir());

    // Write a HAR file where every response includes an ETag
    // so no validator-fields violations are triggered.
    const cleanHar = JSON.stringify({
      log: {
        version: '1.2',
        entries: [
          {
            request: {
              method: 'GET',
              url: 'https://api.example.com/users/1',
              headers: [
                { name: 'Accept', value: 'application/json' },
                { name: 'Host', value: 'http://api.example.com' },
              ],
            },
            response: {
              status: 200,
              headers: [
                { name: 'Content-Type', value: 'application/json' },
                { name: 'ETag', value: '"v1"' },
                { name: 'Date', value: 'Thu, 01 Jan 2026 00:00:00 GMT' },
              ],
              content: { size: 10, text: '{"id":1}' },
            },
            time: 20,
          },
        ],
      },
    });

    writeFileSync(join(getTempDir(), 'clean-traffic.har'), cleanHar);

    writeConfigToTempDir(
      getTempDir(),
      [
        'ruleSets:',
        "  - '@thymian/rules-rfc-9110'",
        'plugins:',
        "  '@thymian/plugin-har': {}",
        "  '@thymian/plugin-http-analyzer': {}",
        "  '@thymian/plugin-reporter':",
        '    options:',
        '      formatters:',
        '        text: {}',
      ].join('\n'),
    );

    const result = execThymianRaw(
      ['analyze', '--traffic', 'har:clean-traffic.har'],
      { cwd: getTempDir() },
    );

    expect(result.exitCode).toBe(0);
  }, 90_000);
});
