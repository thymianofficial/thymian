import { describe, expect, it } from 'vitest';

import { applyReporterSortReportsBy } from '../src/apply-plugin-options.js';
import type { ThymianConfig } from '../src/thymian-config.js';

const REPORTER = '@thymian/plugin-reporter';

function configWith(
  plugins: Record<string, { options?: Record<string, unknown> }>,
): ThymianConfig {
  return { plugins } as unknown as ThymianConfig;
}

describe('applyReporterSortReportsBy', () => {
  it('overrides an existing -o/config sortReportsBy when the flag is set', () => {
    const config = configWith({
      [REPORTER]: { options: { sortReportsBy: 'rule', path: 'report.md' } },
    });

    applyReporterSortReportsBy(config, 'severity');

    // Flag wins; other options are preserved.
    expect(config.plugins[REPORTER]?.options).toEqual({
      sortReportsBy: 'severity',
      path: 'report.md',
    });
  });

  it('leaves the -o/config value untouched when the flag is absent', () => {
    const config = configWith({
      [REPORTER]: { options: { sortReportsBy: 'rule' } },
    });

    applyReporterSortReportsBy(config, undefined);

    expect(config.plugins[REPORTER]?.options).toEqual({
      sortReportsBy: 'rule',
    });
  });

  it('never auto-registers the reporter when it is not configured', () => {
    const config = configWith({});

    applyReporterSortReportsBy(config, 'severity');

    expect(config.plugins[REPORTER]).toBeUndefined();
  });

  it('creates the options object when the reporter is configured without one', () => {
    const config = configWith({ [REPORTER]: {} });

    applyReporterSortReportsBy(config, 'rule');

    expect(config.plugins[REPORTER]?.options).toEqual({
      sortReportsBy: 'rule',
    });
  });
});
