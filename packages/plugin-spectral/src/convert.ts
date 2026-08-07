import type {
  LintExecution,
  Logger,
  RuleDescriptor,
  Severity,
  ThymianFormat,
} from '@thymian/core';

import { mapLocation } from './map-location.js';
import type { SpectralResult } from './spectral-types.js';

/** DiagnosticSeverity → Thymian severity; exact 1:1 for 0/1/2/3. */
const SEVERITY_BY_NUMBER: Record<number, Severity> = {
  0: 'error',
  1: 'warn',
  2: 'info',
  3: 'hint',
};

/** Higher number = more severe, for RuleDescriptor severity aggregation. */
const SEVERITY_RANK: Record<Severity, number> = {
  hint: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function mapSeverity(severity: number, logger: Logger): Severity {
  const mapped = SEVERITY_BY_NUMBER[severity];

  if (mapped === undefined) {
    logger.warn(
      `Unknown Spectral severity ${severity.toString()} — converting conservatively as 'error'.`,
    );
    return 'error';
  }

  return mapped;
}

export interface ConvertedResults {
  executions: LintExecution[];
  rules: RuleDescriptor[];
}

/**
 * Maps Spectral results to failed lint executions plus one RuleDescriptor per
 * distinct code. Every Spectral result is a problem, so every execution is
 * `failed` with the finding's own severity on the status (per-finding
 * fidelity regardless of rule-level severity resolution); the descriptor
 * carries the highest severity seen for its code and links back to Spectral's
 * docs via `documentationUrl` when present.
 */
export function convertResults(
  results: SpectralResult[],
  options: { logger: Logger; format?: ThymianFormat },
): ConvertedResults {
  const executions: LintExecution[] = [];
  const rulesById = new Map<string, RuleDescriptor>();

  for (const result of results) {
    const ruleId = `spectral/${String(result.code)}`;
    const severity = mapSeverity(result.severity, options.logger);

    executions.push({
      kind: 'lint',
      ruleId,
      status: { kind: 'failed', reason: result.message, severity },
      location: mapLocation(result, options.format),
      findings: [],
    });

    const existing = rulesById.get(ruleId);
    if (!existing) {
      rulesById.set(ruleId, {
        id: ruleId,
        severity,
        summary: { text: result.message },
        ...(result.documentationUrl
          ? { helpUri: result.documentationUrl }
          : {}),
      });
    } else {
      if (SEVERITY_RANK[severity] > SEVERITY_RANK[existing.severity]) {
        existing.severity = severity;
      }
      if (!existing.helpUri && result.documentationUrl) {
        existing.helpUri = result.documentationUrl;
      }
    }
  }

  return { executions, rules: [...rulesById.values()] };
}
