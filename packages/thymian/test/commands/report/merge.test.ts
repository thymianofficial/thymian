import { EventEmitter } from 'node:events';
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

process.env.OCLIF_TEST_ROOT = join(import.meta.url, '../../../..');

const mockState: {
  reportConvertInput?: unknown;
  reportConvertResult?: unknown;
  runCalled?: boolean;
} = {};

vi.mock('@thymian/core', async () => {
  const actual = await vi.importActual('@thymian/core');

  class MockThymian {
    emitter = new EventEmitter();
    static DEFAULT_TIMEOUT = 30_000;
    static DEFAULT_IDLE_TIMEOUT = 5_000;

    public ready = vi.fn(async () => undefined);
    public close = vi.fn(async () => undefined);
    public register = vi.fn();
    public run = vi.fn(async (fn: () => Promise<unknown>) => fn());
    public reportConvert = vi.fn(async (input: unknown) => {
      mockState.reportConvertInput = input;
      mockState.runCalled = true;
      return (
        mockState.reportConvertResult ?? {
          report: (actual as typeof import('@thymian/core')).createReport([]),
          unclaimed: [],
        }
      );
    });
  }

  return {
    ...actual,
    Thymian: MockThymian,
  };
});

import {
  createLintExecution,
  createReport,
  createToolRun,
} from '@thymian/core';

import ReportMerge from '../../../src/commands/report/merge.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function mergedReport(failed: boolean) {
  return createReport([
    createToolRun({
      tool: { name: '@thymian/plugin-thymian-report' },
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
    mockState.reportConvertInput = undefined;
    mockState.reportConvertResult = undefined;
    mockState.runCalled = false;
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

  it('uses config-file reports when no --report flag is given (AC 7)', async () => {
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

    await captureOutput(async () => {
      await ReportMerge.run(['--config', configPath, '--no-autoload']);
    });

    expect(mockState.reportConvertInput).toEqual(
      expect.objectContaining({
        reports: [{ type: 'thymian', location: './from-config.json' }],
      }),
    );
  });

  it('lets --report flags replace config-file reports entirely (AC 7)', async () => {
    const configPath = join(tmpDir, 'override.config.yaml');
    writeFileSync(
      configPath,
      [
        'reports:',
        '  - type: thymian',
        '    location: ./config-report.json',
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
      }),
    );
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

  it('fails with exit 2 when no report input is found anywhere (AC 4)', async () => {
    const { error } = await captureOutput(async () => {
      await ReportMerge.run(['--no-autoload']);
    });

    expect(error?.message).toContain('No report input found');
    expect(mockState.runCalled).toBeFalsy();
    expect(
      (error as { oclif?: { exit?: number } } | undefined)?.oclif?.exit,
    ).toBe(2);
  });

  it('fails with exit 2 naming the unclaimed input and listing supported types (AC 4)', async () => {
    mockState.reportConvertResult = {
      report: mergedReport(false),
      unclaimed: [{ type: 'foo', location: './r.json' }],
    };

    const { error } = await captureOutput(async () => {
      await ReportMerge.run([
        '--report',
        'thymian:./claimed.json',
        '--report',
        'foo:./r.json',
        '--no-autoload',
      ]);
    });

    expect(error?.message).toContain('"foo:./r.json"');
    expect(error?.message).toContain(
      'Supported report types in this run: thymian',
    );
    expect(
      (error as { oclif?: { exit?: number } } | undefined)?.oclif?.exit,
    ).toBe(2);
  });

  it('distinguishes an unclaimed input of a supported type from an unsupported type (AC 4)', async () => {
    mockState.reportConvertResult = {
      report: mergedReport(false),
      unclaimed: [{ type: 'thymian', location: './missing.json' }],
    };

    const { error } = await captureOutput(async () => {
      await ReportMerge.run([
        '--report',
        'thymian:./claimed.json',
        '--report',
        'thymian:./missing.json',
        '--no-autoload',
      ]);
    });

    expect(error?.message).toContain(
      'Report input "thymian:./missing.json" has a supported type but was not claimed — check the location',
    );
    expect(error?.message).not.toContain('No registered plugin claims');
    expect(
      (error as { oclif?: { exit?: number } } | undefined)?.oclif?.exit,
    ).toBe(2);
  });

  it('shows the no-claimant hint when nothing was claimed (AC 4)', async () => {
    mockState.reportConvertResult = {
      report: createReport([]),
      unclaimed: [{ type: 'foo', location: './r.json' }],
    };

    const { error } = await captureOutput(async () => {
      await ReportMerge.run(['--report', 'foo:./r.json', '--no-autoload']);
    });

    expect(error?.message).toContain(
      'No converter plugin claimed any report input',
    );
    expect(error?.message).not.toContain('Supported report types');
    expect(
      (error as { oclif?: { exit?: number } } | undefined)?.oclif?.exit,
    ).toBe(2);
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
    expect(stdout).toContain('@thymian/plugin-thymian-report');
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
