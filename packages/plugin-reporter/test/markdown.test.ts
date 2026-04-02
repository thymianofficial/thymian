import {
  NoopLogger,
  ThymianReport,
  ThymianReportSeverity,
} from '@thymian/core';
import { writeFile } from 'fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  mapSeverityToBadge,
  MarkdownFormatter,
} from '../src/formatters/markdown.js';

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

describe('MarkdownFormatter', () => {
  const createReport = (
    overrides: Partial<ThymianReport> = {},
  ): ThymianReport => ({
    source: 'source-file.ts',
    message: 'Test summary',
    ...overrides,
  });

  const formatterOptions = { path: 'test-report.md' };
  let formatter = new MarkdownFormatter(new NoopLogger());

  beforeEach(async () => {
    formatter = new MarkdownFormatter(new NoopLogger());
    await formatter.init(formatterOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should map severity to the correct badge', () => {
    const badges: Record<ThymianReportSeverity, string> = {
      error: '✖ error',
      warn: '⚠ warn',
      hint: 'ℹ hint',
      info: 'info',
    };

    Object.entries(badges).forEach(([severity, badge]) => {
      expect(mapSeverityToBadge(severity as ThymianReportSeverity)).toBe(badge);
    });
  });

  it('should save report data to file when flushed', async () => {
    const reports = [
      createReport({
        source: 'rule-1',
        message: 'Summary 1',
        sections: [
          {
            heading: 'Section 1',
            items: [
              {
                severity: 'error',
                message: 'Error item',
                ruleName: 'rfc9110/must-include-date-header',
              },
              { severity: 'warn', message: 'Warn item' },
            ],
          },
        ],
      }),
      createReport({
        source: 'rule-2',
        message: 'Summary 2',
        sections: [
          {
            heading: 'Section 2',
            items: [{ severity: 'hint', message: 'Hint item' }],
          },
        ],
      }),
    ];

    reports.forEach((report) => formatter.report(report));

    vi.mocked(writeFile).mockResolvedValue(); // Mock writeFile resolution

    await formatter.flush();

    expect(writeFile).toHaveBeenCalledOnce();
    const [path, content] = vi.mocked(writeFile).mock.calls[0];
    expect(path).toBe('test-report.md');

    expect(content).toContain('# Thymian Report');
    expect(content).toContain('A total of 2 reports with 3 items were found.');
    expect(content).toContain('**✖ error**: Error item');
    expect(content).toContain('*Rule: rfc9110/must-include-date-header*');
    expect(content).toContain('**⚠ warn**: Warn item');
    expect(content).toContain('**ℹ hint**: Hint item');
  });

  it('should group reports by source with sections and headings', async () => {
    const reports = [
      createReport({
        source: 'rule-a',
        message: 'Rule A summary',
        sections: [
          {
            heading: 'GET /users → 200',
            items: [{ severity: 'error', message: 'Missing header' }],
          },
          {
            heading: 'POST /users → 201',
            items: [{ severity: 'warn', message: 'Deprecated field' }],
          },
        ],
      }),
      createReport({
        source: 'rule-b',
        message: 'Rule B summary',
        sections: [
          {
            heading: 'GET /items → 200',
            items: [{ severity: 'hint', message: 'Optional improvement' }],
          },
        ],
      }),
    ];

    reports.forEach((report) => formatter.report(report));

    vi.mocked(writeFile).mockResolvedValue();

    await formatter.flush();

    expect(writeFile).toHaveBeenCalledOnce();
    const [, content] = vi.mocked(writeFile).mock.calls[0];

    expect(content).toContain('## rule-a');
    expect(content).toContain('### GET /users → 200');
    expect(content).toContain('### POST /users → 201');
    expect(content).toContain('## rule-b');
    expect(content).toContain('### GET /items → 200');
  });

  it('should include ruleName if present', async () => {
    const report = createReport({
      source: 'test-rule',
      message: 'Test summary',
      sections: [
        {
          heading: 'Test Section',
          items: [
            {
              severity: 'error',
              message: 'Missing required header',
              ruleName: 'rfc9110/must-include-date-header',
            },
          ],
        },
      ],
    });

    formatter.report(report);

    vi.mocked(writeFile).mockResolvedValue();

    await formatter.flush();

    expect(writeFile).toHaveBeenCalledOnce();
    const [, content] = vi.mocked(writeFile).mock.calls[0];

    expect(content).toContain('**✖ error**: Missing required header');
    expect(content).toContain('*Rule: rfc9110/must-include-date-header*');
  });

  it('should not include ruleName line when not present', async () => {
    const report = createReport({
      source: 'test-rule',
      message: 'Test summary',
      sections: [
        {
          heading: 'Test Section',
          items: [
            {
              severity: 'warn',
              message: 'Some warning',
            },
          ],
        },
      ],
    });

    formatter.report(report);

    vi.mocked(writeFile).mockResolvedValue();

    await formatter.flush();

    expect(writeFile).toHaveBeenCalledOnce();
    const [, content] = vi.mocked(writeFile).mock.calls[0];

    expect(content).toContain('**⚠ warn**: Some warning');
    expect(content).not.toContain('*Rule:');
  });

  it('should include item details if present', async () => {
    const report = createReport({
      source: 'test-rule',
      message: 'Test summary',
      sections: [
        {
          heading: 'Test Section',
          items: [
            {
              severity: 'error',
              message: 'Error message',
              details: 'Additional report details.',
            },
          ],
        },
      ],
    });

    formatter.report(report);

    vi.mocked(writeFile).mockResolvedValue();

    await formatter.flush();

    expect(writeFile).toHaveBeenCalledOnce();
    const [, content] = vi.mocked(writeFile).mock.calls[0];

    expect(content).toContain('Additional report details.');
  });

  it('should include links if present', async () => {
    const report = createReport({
      source: 'test-rule',
      message: 'Test summary',
      sections: [
        {
          heading: 'Test Section',
          items: [
            {
              severity: 'warn',
              message: 'Warning message',
              links: [
                {
                  title: 'RFC 9110',
                  url: 'https://www.rfc-editor.org/rfc/rfc9110',
                },
              ],
            },
          ],
        },
      ],
    });

    formatter.report(report);

    vi.mocked(writeFile).mockResolvedValue();

    await formatter.flush();

    expect(writeFile).toHaveBeenCalledOnce();
    const [, content] = vi.mocked(writeFile).mock.calls[0];

    expect(content).toContain(
      '[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)',
    );
  });

  it('should return undefined when no reports are present', async () => {
    const result = await formatter.flush();

    expect(result).toBeUndefined();
    expect(writeFile).not.toHaveBeenCalled();
  });
});
