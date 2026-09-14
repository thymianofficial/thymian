import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { captureOutput } from '@oclif/test';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';

process.env.OCLIF_TEST_ROOT = join(import.meta.url, '../../..');

// The command gathers RuleMeta through interactive prompts before it ever
// reaches the write step under test. Mock the prompt module so the integration
// tests drive it deterministically; the extension behavior is about the write
// step, not the prompt flow.
vi.mock('@thymian/common-cli/prompts', () => ({
  input: vi.fn(),
  select: vi.fn(),
  checkbox: vi.fn(),
}));

import { checkbox, input, select } from '@thymian/common-cli/prompts';

import GenerateRule, {
  resolveRuleOutputPath,
} from '../../src/commands/generate/rule.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Prime the mocked prompts with a minimal valid answer set: name "my-rule",
 * severity "error", a single "lint" (static) rule type, and empty
 * url/description/summary/appliesTo. `--url ''` is always passed so the url
 * prompt is skipped (empty string is not nullish), keeping `input` call order
 * fixed: name, description, summary.
 */
function primePrompts(): void {
  vi.mocked(input)
    .mockResolvedValueOnce('my-rule') // name
    .mockResolvedValue(''); // description, summary
  vi.mocked(select).mockResolvedValue('error');
  vi.mocked(checkbox)
    .mockResolvedValueOnce(['static']) // rule types (required, non-empty)
    .mockResolvedValue([]); // appliesTo
}

describe('generate rule — resolveRuleOutputPath (unit)', () => {
  describe('default (ESM/TypeScript) mode', () => {
    it('no extension defaults to .ts', () => {
      expect(resolveRuleOutputPath('my-rule', false)).toEqual({
        ok: true,
        output: 'my-rule.ts',
      });
    });

    it.each(['.ts', '.js', '.mjs'])(
      'keeps a loadable ESM extension %s unchanged',
      (ext) => {
        expect(resolveRuleOutputPath(`my-rule${ext}`, false)).toEqual({
          ok: true,
          output: `my-rule${ext}`,
        });
      },
    );

    it.each(['.mts', '.cts'])('declines %s (both modes)', (ext) => {
      const result = resolveRuleOutputPath(`my-rule${ext}`, false);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain('use .ts instead');
    });

    it('declines .d.ts (both modes) — extname alone would see it as .ts', () => {
      const result = resolveRuleOutputPath('my-rule.d.ts', false);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain(
        'declaration file',
      );
    });

    it('declines .cjs in default mode (ESM export default cannot live in .cjs)', () => {
      const result = resolveRuleOutputPath('my-rule.cjs', false);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain('--cjs');
    });

    it('declines an out-of-set extension', () => {
      const result = resolveRuleOutputPath('my-rule.txt', false);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain(
        'expected one of .ts, .js, .mjs',
      );
    });
  });

  describe('--cjs mode', () => {
    it('no extension appends .cjs', () => {
      expect(resolveRuleOutputPath('my-rule', true)).toEqual({
        ok: true,
        output: 'my-rule.cjs',
      });
    });

    it('keeps an explicit .cjs unchanged', () => {
      expect(resolveRuleOutputPath('my-rule.cjs', true)).toEqual({
        ok: true,
        output: 'my-rule.cjs',
      });
    });

    it.each(['.js', '.ts', '.mjs'])(
      'declines a non-.cjs extension %s under --cjs',
      (ext) => {
        const result = resolveRuleOutputPath(`my-rule${ext}`, true);
        expect(result.ok).toBe(false);
        expect(result.ok === false && result.reason).toContain(
          'must be written to a .cjs file',
        );
      },
    );

    it.each(['.mts', '.cts'])('declines %s under --cjs too', (ext) => {
      const result = resolveRuleOutputPath(`my-rule${ext}`, true);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain('use .ts instead');
    });

    it('declines .d.ts under --cjs too', () => {
      const result = resolveRuleOutputPath('my-rule.d.ts', true);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain(
        'declaration file',
      );
    });
  });
});

describe('generate rule (integration)', () => {
  let exitSpy: MockInstance<typeof vi.spyOn>;
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = join(__dirname, '__tmp_generate_rule__');
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
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as () => never);
    primePrompts();
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('default --output with no extension writes a .ts file', async () => {
    const testDir = join(tmpDir, 'default-no-ext');
    mkdirSync(testDir, { recursive: true });

    const { stdout } = await captureOutput(async () => {
      await GenerateRule.run([
        '--cwd',
        testDir,
        '--url',
        '',
        '--output',
        'foo',
      ]);
    });

    expect(stdout).toContain('Rule written to');
    expect(existsSync(join(testDir, 'foo.ts'))).toBe(true);
    expect(existsSync(join(testDir, 'foo'))).toBe(false);

    const written = await readFile(join(testDir, 'foo.ts'), 'utf-8');
    expect(written).toContain('export default');
  });

  it('default --output .mts declines with a framed error and writes nothing', async () => {
    const testDir = join(tmpDir, 'default-mts');
    mkdirSync(testDir, { recursive: true });

    const { error } = await captureOutput(async () => {
      await GenerateRule.run([
        '--cwd',
        testDir,
        '--url',
        '',
        '--output',
        'foo.mts',
      ]);
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain('use .ts instead');
    expect(existsSync(join(testDir, 'foo.mts'))).toBe(false);
  });

  it('--cjs --output with no extension writes foo.cjs (not foo / foo.js)', async () => {
    const testDir = join(tmpDir, 'cjs-no-ext');
    mkdirSync(testDir, { recursive: true });

    const { stdout } = await captureOutput(async () => {
      await GenerateRule.run([
        '--cwd',
        testDir,
        '--cjs',
        '--url',
        '',
        '--output',
        'foo',
      ]);
    });

    expect(stdout).toContain('Rule written to');
    expect(existsSync(join(testDir, 'foo.cjs'))).toBe(true);
    expect(existsSync(join(testDir, 'foo'))).toBe(false);
    expect(existsSync(join(testDir, 'foo.js'))).toBe(false);

    const written = await readFile(join(testDir, 'foo.cjs'), 'utf-8');
    expect(written).toContain('require');
    expect(written).toContain('module.exports');
  });

  it('--cjs --output foo.cjs is written as-is', async () => {
    const testDir = join(tmpDir, 'cjs-explicit');
    mkdirSync(testDir, { recursive: true });

    await captureOutput(async () => {
      await GenerateRule.run([
        '--cwd',
        testDir,
        '--cjs',
        '--url',
        '',
        '--output',
        'foo.cjs',
      ]);
    });

    expect(existsSync(join(testDir, 'foo.cjs'))).toBe(true);
  });

  it('--cjs --output foo.js declines and writes nothing', async () => {
    const testDir = join(tmpDir, 'cjs-js');
    mkdirSync(testDir, { recursive: true });

    const { error } = await captureOutput(async () => {
      await GenerateRule.run([
        '--cwd',
        testDir,
        '--cjs',
        '--url',
        '',
        '--output',
        'foo.js',
      ]);
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain('must be written to a .cjs file');
    expect(existsSync(join(testDir, 'foo.js'))).toBe(false);
    expect(existsSync(join(testDir, 'foo.cjs'))).toBe(false);
  });

  it('no --output prints the ESM template to stdout and writes no file', async () => {
    const testDir = join(tmpDir, 'stdout-esm');
    mkdirSync(testDir, { recursive: true });

    const { stdout } = await captureOutput(async () => {
      await GenerateRule.run(['--cwd', testDir, '--url', '']);
    });

    expect(stdout).toContain("import { httpRule } from '@thymian/core'");
    expect(stdout).toContain('export default');
    expect(stdout).not.toContain('Rule written to');
  });

  it('no --output with --cjs prints the CommonJS template to stdout', async () => {
    const testDir = join(tmpDir, 'stdout-cjs');
    mkdirSync(testDir, { recursive: true });

    const { stdout } = await captureOutput(async () => {
      await GenerateRule.run(['--cwd', testDir, '--cjs', '--url', '']);
    });

    expect(stdout).toContain("const { httpRule } = require('@thymian/core')");
    expect(stdout).toContain('module.exports');
    expect(stdout).not.toContain('Rule written to');
  });
});
