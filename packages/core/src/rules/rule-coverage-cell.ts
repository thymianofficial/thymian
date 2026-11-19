// What one coverage-record cell must be for the coverage lanes to accept
// it, kept in one place so no two readers of the same cell disagree.
// Internal: not re-exported from `rules/index.ts`.

import type { CoverageCell, CoverageContext } from './rule-coverage.js';
import type { CoverageViolation } from './rule-coverage-checker.js';

export function nonEmpty(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

// The shape every cell for a context a rule does not declare must have: an
// object with a non-empty note, never a bare literal. Shared by executable
// and informational entries — every context of an informational rule is
// undeclared — so the same fault reads the same for every rule. Returns the
// cell narrowed to its object shape when it passes, so no caller repeats
// the bare-literal guard.
export function undeclaredCellShape(
  ruleName: string,
  context: CoverageContext,
  cell: CoverageCell,
): { violation: CoverageViolation } | { cell: Exclude<CoverageCell, string> } {
  if (typeof cell === 'string') {
    return {
      violation: {
        code: 'undeclared-context-cell-invalid',
        rule: ruleName,
        context,
        message: `'${ruleName}' does not declare '${context}', but its cell is the bare literal '${cell}' rather than an impossible cell with a reason and a note.`,
      },
    };
  }
  if (!nonEmpty(cell.note)) {
    return {
      violation: {
        code: 'undeclared-context-cell-invalid',
        rule: ruleName,
        context,
        message: `'${ruleName}''s cell for '${context}' has an empty note.`,
      },
    };
  }
  return { cell };
}
