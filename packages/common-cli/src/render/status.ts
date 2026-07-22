import { ux } from '@oclif/core';
import {
  type ExecutionStatus,
  type Severity,
  SEVERITY_COLORS,
  SEVERITY_SYMBOLS,
  skippedSymbol,
  successSymbol,
} from '@thymian/core';

export function renderStatus(
  status: ExecutionStatus,
  severity: Severity | undefined,
  fallbackReason: string | undefined,
): string {
  switch (status.kind) {
    case 'passed': {
      const duration =
        status.durationMilliseconds !== undefined
          ? ` (${status.durationMilliseconds.toFixed(2)}ms)`
          : '';
      return `${successSymbol} passed${duration}`;
    }
    case 'failed': {
      const resolved = severity ?? 'error';
      const reason =
        (status.reason ?? fallbackReason)
          ? `: ${status.reason ?? fallbackReason}`
          : '';
      const duration =
        status.durationMilliseconds !== undefined
          ? ` (${status.durationMilliseconds.toFixed(2)}ms)`
          : '';
      return `${ux.colorize(SEVERITY_COLORS[resolved], `${SEVERITY_SYMBOLS[resolved]} ${resolved}`)}${reason}${duration}`;
    }
    case 'skipped':
      return `${skippedSymbol}  skipped${status.reason ? `: ${status.reason}` : ''}`;
  }
}
