import type { Command } from '@oclif/core';
import type {
  ReportInput,
  SortReportsBy,
  SpecificationInput,
  Thymian,
} from '@thymian/core';

import { enforceReportClaims } from './report-claim-enforcement.js';
import { handleWorkflowOutcome } from './workflow-outcome.js';

/**
 * Structural surface `runReportAssembly` needs from a command for the
 * claim-enforcement and rendering steps it delegates to. `thymian` and the
 * two base flags it also needs travel as separate arguments instead:
 * `BaseCliRunCommand` declares both `protected`, and TypeScript only lets a
 * protected member satisfy a structural type when that type originates from
 * the same class hierarchy — an unrelated interface can't require it as a
 * public property. The command subclass already has access to its own
 * protected members and passes them through directly.
 */
export interface ReportAssemblyCommand extends Pick<Command, 'error' | 'exit'> {
  guidance(message: string): void;
}

/**
 * Shared spine of the report-assembly commands (`thymian report convert` /
 * `thymian report merge`): given each command's already-resolved report and
 * spec inputs — the one place the two commands deliberately differ; convert
 * reads `--report` flags over the config `reports` key, merge reads
 * `--report` flags only (ADR-0020), while specifications follow the normal
 * flags-over-config chain for both — fail usage-style on an empty input set,
 * run the core convert workflow, enforce input claims (ADR-0017), and hand
 * the outcome to the standard renderer/exit-code path. Extracted so
 * behavior and user-visible wording can't silently drift between the two
 * commands (#507 review).
 */
export async function runReportAssembly(
  command: ReportAssemblyCommand,
  options: {
    thymian: Pick<Thymian, 'reportConvert' | 'run'>;
    reports: ReportInput[];
    specification: SpecificationInput[];
    validateSpecs: boolean;
    sortReportsBy?: SortReportsBy;
  },
  noReportInputMessage: string,
): Promise<void> {
  const { thymian, reports, specification, validateSpecs, sortReportsBy } =
    options;

  if (reports.length === 0) {
    command.error(noReportInputMessage, { exit: 2 });
  }

  const outcome = await thymian.run(() =>
    thymian.reportConvert({ reports, specification, validateSpecs }),
  );

  enforceReportClaims(command, reports, outcome.unclaimed);

  handleWorkflowOutcome(command, outcome.report, {}, { sortReportsBy });
}
