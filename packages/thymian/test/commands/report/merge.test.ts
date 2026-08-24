import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Config } from '@oclif/core';
import { captureOutput } from '@oclif/test';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

process.env.OCLIF_TEST_ROOT = fileURLToPath(
  new URL('../../..', import.meta.url),
);

vi.mock('@thymian/core', async () =>
  (await import('../../helpers/mock-thymian.js')).mockThymianCore(),
);

import {
  createLintExecution,
  createReport,
  createToolRun,
} from '@thymian/core';

import ReportMerge from '../../../src/commands/report/merge.js';
import { mockState, resetMockState } from '../../helpers/mock-thymian.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// The claim-enforcement wording and the shared run/enforce/render spine are
// covered by common-cli's unit tests (report-claim-enforcement.test.ts) and
// convert.test.ts's integration case — this file asserts what is specific to
// `report merge`: CLI-only input resolution (#362 review decision) and the
// merged-report outcome handling.
function mergedReport(failed: boolean) {
  return createReport([
    createToolRun({
      tool: { name: 'fixture-thymian-source' },
      runType: 'lint',
      executions: failed
        ? [
            createLintExecution({
              location: { type: 'custom', value: './a.json' },
              ruleId: 'example/rule',
              status: { kind: 'failed', reason: 'persisted finding' },
            }),
          ]
        : [],
    }),
    createToolRun({
      tool: { name: '@thymian/plugin-spectral' },
      runType: 'lint',
      executions: [],
    }),
  ]);
}

describe('report merge command', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = join(__dirname, '__tmp_report_merge__');
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true });
    }
    mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true });
    }
  });

  beforeEach(() => {
    resetMockState();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('forwards mixed --report inputs and --spec to the convert workflow (AC 1, 3)', async () => {
    await captureOutput(async () => {
      await ReportMerge.run([
        '--report',
        'thymian:./a.json',
        '--report',
        'spectral:./b.json',
        '--spec',
        'openapi:./api.yaml',
        '--no-autoload',
      ]);
    });

    expect(mockState.runCalled).toBe(true);
    expect(mockState.reportConvertInput).toEqual(
      expect.objectContaining({
        reports: [
          { type: 'thymian', location: './a.json' },
          { type: 'spectral', location: './b.json' },
        ],
        specification: [{ type: 'openapi', location: './api.yaml' }],
        validateSpecs: false,
      }),
    );
  });

  it('ignores config-file reports entirely — merge reads CLI arguments only (#362 review decision)', async () => {
    const configPath = join(tmpDir, 'reports.config.yaml');
    writeFileSync(
      configPath,
      [
        'reports:',
        '  - type: thymian',
        '    location: ./from-config.json',
        'plugins: {}',
      ].join('\n'),
    );

    const { error } = await captureOutput(async () => {
      await ReportMerge.run(['--config', configPath, '--no-autoload']);
    });

    // Config reports do not count as inputs: without --report the command
    // fails usage-style, and the message must not point at the config file.
    expect(error?.message).toBe(
      'No report input found. Provide one with --report.',
    );
    expect(mockState.runCalled).toBeFalsy();
    expect(
      (error as { oclif?: { exit?: number } } | undefined)?.oclif?.exit,
    ).toBe(2);
  });

  it('ignores config-file specifications — only --spec reaches the merge workflow', async () => {
    const configPath = join(tmpDir, 'specs.config.yaml');
    writeFileSync(
      configPath,
      [
        'specifications:',
        '  - type: openapi',
        '    location: ./config-api.yaml',
        'plugins: {}',
      ].join('\n'),
    );

    await captureOutput(async () => {
      await ReportMerge.run([
        '--config',
        configPath,
        '--report',
        'thymian:./flag-report.json',
        '--no-autoload',
      ]);
    });

    expect(mockState.reportConvertInput).toEqual(
      expect.objectContaining({
        reports: [{ type: 'thymian', location: './flag-report.json' }],
        specification: [],
      }),
    );
  });

  it('fails with exit 2 when no report input is given (AC 4)', async () => {
    const { error } = await captureOutput(async () => {
      await ReportMerge.run(['--no-autoload']);
    });

    expect(error?.message).toContain('No report input found');
    expect(mockState.runCalled).toBeFalsy();
    expect(
      (error as { oclif?: { exit?: number } } | undefined)?.oclif?.exit,
    ).toBe(2);
  });

  it('forwards --validate-specs as validateSpecs: true (AC 3)', async () => {
    await captureOutput(async () => {
      await ReportMerge.run([
        '--report',
        'thymian:./report.json',
        '--spec',
        'openapi:./api.yaml',
        '--validate-specs',
        '--no-autoload',
      ]);
    });

    expect(mockState.reportConvertInput).toEqual(
      expect.objectContaining({
        validateSpecs: true,
      }),
    );
  });

  it('renders the merged report and exits 0 on a clean outcome (AC 5)', async () => {
    mockState.reportConvertResult = {
      report: mergedReport(false),
      unclaimed: [],
    };

    const { error, stdout } = await captureOutput(async () => {
      await ReportMerge.run([
        '--report',
        'thymian:./a.json',
        '--report',
        'spectral:./b.json',
        '--no-autoload',
      ]);
    });

    expect(error).toBeUndefined();
    // renderReport emits a heading per run naming the tool — both source
    // runs must appear in the merged render.
    expect(stdout).toContain('fixture-thymian-source');
    expect(stdout).toContain('@thymian/plugin-spectral');
  });

  it('exits 1 when the merged report contains failed executions (ADR-0015, AC 5)', async () => {
    mockState.reportConvertResult = {
      report: mergedReport(true),
      unclaimed: [],
    };

    const { error } = await captureOutput(async () => {
      await ReportMerge.run(['--report', 'thymian:./a.json', '--no-autoload']);
    });

    expect(
      (error as { oclif?: { exit?: number } } | undefined)?.oclif?.exit,
    ).toBe(1);
  });

  // Needs the built package: oclif discovers commands from dist/commands
  // (package.json "oclif.commands"), and the test target does not depend on
  // build. Skips visibly instead of failing on an unbuilt checkout.
  it.skipIf(
    !existsSync(join(__dirname, '../../../dist/commands/report/merge.js')),
  )(
    'registers merge under the report topic with the --report flag (AC 1)',
    async () => {
      const config = await Config.load(join(__dirname, '../../..'));

      const loadable = config.findCommand('report:merge', { must: true });
      const command = await loadable.load();

      expect(command.flags['report']).toBeDefined();
    },
  );
});
