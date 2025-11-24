import { ThymianReport, ThymianReportSeverity } from '@thymian/core';
import { writeFile } from 'fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MarkdownFormatter } from '../src/formatters/markdown.js';

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

describe('MarkdownFormatter', () => {
  const createReport = (
    overrides: Partial<ThymianReport> = {},
  ): ThymianReport => ({
    producer: 'TestProducer',
    source: 'source-file.ts',
    severity: 'error',
    summary: 'Test summary',
    title: 'Test Title',
    details: 'Detailed description.',
    category: 'Test Category',
    ...overrides,
  });

  const formatterOptions = { path: 'test-report.md' };
  let formatter = new MarkdownFormatter();

  beforeEach(async () => {
    formatter = await new MarkdownFormatter().init(formatterOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should map severity to the correct badge', () => {
    const badges: Record<ThymianReportSeverity, string> = {
      error: '❌ ERROR',
      warn: '⚠️ WARN',
      hint: '💡 HINT',
      info: 'ℹ️ INFO',
    };

    Object.entries(badges).forEach(([severity, badge]) => {
      expect(
        (formatter as any).mapSeverityToBadge(
          severity as ThymianReportSeverity,
        ),
      ).toBe(badge);
    });
  });

  it('should save report data to file when flushed', async () => {
    const reports = [
      createReport({
        severity: 'error',
        category: 'Category1',
        title: 'Title1',
      }),
      createReport({
        severity: 'warn',
        category: 'Category1',
        title: 'Title2',
      }),
      createReport({
        severity: 'hint',
        category: 'Category2',
        title: 'Title3',
      }),
    ];

    reports.forEach((report) => formatter.report(report));

    vi.mocked(writeFile).mockResolvedValue(); // Mock writeFile resolution

    await formatter.flush();

    expect(writeFile).toHaveBeenCalledOnce();
    const [path, content] = vi.mocked(writeFile).mock.calls[0];
    expect(path).toBe('test-report.md');

    expect(content).toContain('# Thymian Report');
    expect(content).toContain('A total of 3 reports were found.');
    expect(content).toContain('❌ ERROR: Test summary');
    expect(content).toContain('⚠️ WARN: Test summary');
    expect(content).toContain('💡 HINT: Test summary');
  });

  it('should group reports by producer, category, and title', async () => {
    const reports = [
      createReport({
        producer: 'Producer1',
        category: 'Category1',
        title: 'Title1',
      }),
      createReport({
        producer: 'Producer1',
        category: 'Category1',
        title: 'Title2',
      }),
      createReport({
        producer: 'Producer2',
        category: 'Category2',
        title: 'Title3',
      }),
    ];

    reports.forEach((report) => formatter.report(report));

    vi.mocked(writeFile).mockResolvedValue();

    await formatter.flush();

    expect(writeFile).toHaveBeenCalledOnce();
    const [, content] = vi.mocked(writeFile).mock.calls[0];

    expect(content).toContain('## Producer1');
    expect(content).toContain('### Category1');
    expect(content).toContain('#### Title1');
    expect(content).toContain('#### Title2');
    expect(content).toContain('## Producer2');
    expect(content).toContain('### Category2');
    expect(content).toContain('#### Title3');
  });

  it('should include report details if present', async () => {
    const report = createReport({ details: 'Additional report details.' });

    formatter.report(report);

    vi.mocked(writeFile).mockResolvedValue();

    await formatter.flush();

    expect(writeFile).toHaveBeenCalledOnce();
    const [, content] = vi.mocked(writeFile).mock.calls[0];

    expect(content).toContain('Additional report details.');
  });
});
