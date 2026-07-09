import { join } from 'node:path';

import { NoopLogger } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { FORMATTER_REGISTRY } from '../src/get-formatters.js';

const pluginOptions = { cwd: '/base', logger: new NoopLogger() };

describe('FORMATTER_REGISTRY.markdown.prepareOptions', () => {
  it('joins a configured relative path onto cwd', () => {
    const prepared = FORMATTER_REGISTRY.markdown.prepareOptions(
      { path: 'custom/report.md' },
      pluginOptions,
    );

    expect(prepared.path).toBe(join('/base', 'custom/report.md'));
  });

  it('falls back to the default path when none is configured', () => {
    const prepared = FORMATTER_REGISTRY.markdown.prepareOptions(
      {},
      pluginOptions,
    );

    expect(prepared.path).toBe(join('/base', '.thymian/reports/report.md'));
  });

  it('does not let an explicit undefined path wipe the default', () => {
    const prepared = FORMATTER_REGISTRY.markdown.prepareOptions(
      { path: undefined },
      pluginOptions,
    );

    expect(prepared.path).toBe(join('/base', '.thymian/reports/report.md'));
  });
});

describe('FORMATTER_REGISTRY.csv.prepareOptions', () => {
  it('joins a configured relative path onto cwd', () => {
    const prepared = FORMATTER_REGISTRY.csv.prepareOptions(
      { path: 'custom/report.csv' },
      pluginOptions,
    );

    expect(prepared.path).toBe(join('/base', 'custom/report.csv'));
  });

  it('falls back to the default path when none is configured', () => {
    const prepared = FORMATTER_REGISTRY.csv.prepareOptions({}, pluginOptions);

    expect(prepared.path).toBe(join('/base', '.thymian/reports/report.csv'));
  });
});
