import type { ThymianReport, ThymianReportSection } from '@thymian/core';

import type { HttpTesterRuleDiagnostics } from './http-test-api-context.js';

export function createHttpTestDiagnosticsReport(
  pluginName: string,
  diagnosticsByRule?: Partial<Record<string, HttpTesterRuleDiagnostics>>,
): ThymianReport | undefined {
  const entries = Object.entries(diagnosticsByRule ?? {});

  if (entries.length === 0) {
    return undefined;
  }

  const sections = entries.map<ThymianReportSection>(
    ([ruleName, diagnostics]) => {
      const skipped = diagnostics?.skippedCases ?? [];
      const failed = diagnostics?.failedCases ?? [];

      return {
        heading: `${ruleName} (${skipped.length} skipped, ${failed.length} failed)`,
        items: [
          ...skipped.map(({ name, reason }) => ({
            message: `Skipped "${name}" because`,
            details: reason,
            severity: 'info' as const,
          })),
          ...failed.map(({ name, reason }) => ({
            message: `Failed ${name}`,
            details: reason,
            severity: 'info' as const,
          })),
        ],
      };
    },
  );

  return {
    source: `${pluginName}: skipped and failed test cases`,
    message: `${entries.length} rule${entries.length > 1 ? 's' : ''} could not be checked completely because of skipped and failed transactions.`,
    sections,
  };
}
