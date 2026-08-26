import { randomUUID } from 'node:crypto';

import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { Location, Severity, ToolRun } from './report.js';

/**
 * The polarity every diff change carries: something appeared in head, changed
 * between the sides, or disappeared from base. Which polarities a concrete
 * change kind supports is narrowed per kind (run-result and rule changes are
 * added/removed only — a "changed" run result surfaces as a removed+added
 * pair by design, #502).
 */
export type ReportDiffChangePolarity = 'added' | 'changed' | 'removed';

/**
 * Common shape of every diff change. `kind` discriminates the change type
 * (mirroring the report model's discriminator convention), `change` carries
 * the polarity.
 */
export interface ReportDiffChangeBase {
  kind: 'run-result' | 'specification' | 'rule';
  change: ReportDiffChangePolarity;
}

/**
 * An execution outcome (a failed lint/test/analyze execution) that exists on
 * only one side: `added` = a regression (new in head), `removed` = an
 * improvement (resolved since base). There is deliberately no `changed`
 * polarity — identity includes the failure details, so a reworded reason or
 * a reconfigured severity yields a removed+added pair.
 */
export interface RunResultChange extends ReportDiffChangeBase {
  kind: 'run-result';
  change: 'added' | 'removed';
  runType: ToolRun['runType'];
  /** Resolved severity (`status.severity ?? rule severity ?? 'error'`). */
  severity: Severity;
  ruleId?: string;
  /** The failed status' custom reason, when present. */
  reason?: string;
  /** Test-case name, for `test` executions. */
  testCase?: string;
  /** The execution's location on the side it exists on. */
  location?: Location;
  /** Human-readable location label (e.g. `GET /orders`), when resolvable. */
  locationLabel?: string;
}

/**
 * An endpoint that was added to, removed from, or changed in the underlying
 * specification, detected over the embedded Thymian format graphs.
 */
export interface SpecificationChange extends ReportDiffChangeBase {
  kind: 'specification';
  change: ReportDiffChangePolarity;
  /** Human-readable endpoint label (e.g. `GET /orders`). */
  endpoint: string;
  method: string;
  path: string;
  /**
   * Only on `change: 'changed'`: which endpoint aspects differ between the
   * sides (e.g. `queryParameters`, `body`, `responses`).
   */
  changedAspects?: string[];
}

/** A ruleset or an individual rule that appeared or disappeared. */
export interface RuleChange extends ReportDiffChangeBase {
  kind: 'rule';
  change: 'added' | 'removed';
  /** Whether this entry covers a whole ruleset or a single rule. */
  scope: 'rule' | 'ruleset';
  /** Rule id, or the ruleset prefix (the id segment before the first `/`). */
  id: string;
  /** Display name of the rule, when its descriptor carries one. */
  name?: string;
}

export type ReportDiffChange =
  RunResultChange | SpecificationChange | RuleChange;

/**
 * The diff document — the structured comparison of two Thymian reports.
 * A deliberate sibling of {@link Report} (same identity/timestamp
 * conventions), not a `Report` itself: it does not flow through the
 * `core.report` event or the file formatters (#502, ADR-0021).
 */
export interface ReportDiff {
  /** Stable diff identifier. */
  diffId: string;
  /** ISO timestamp when the diff was computed. */
  createdAt: string;
  /** `reportId` of the base (old/reference) input report. */
  baseReportId: string;
  /** `reportId` of the head (new/compared) input report. */
  headReportId: string;
  /** `createdAt` read from the base input report. */
  baseCreatedAt: string;
  /** `createdAt` read from the head input report. */
  headCreatedAt: string;
  /** All detected changes, in deterministic order. */
  changes: ReportDiffChange[];
}

/** Mint the diff document envelope (mirrors `createReport`'s identity style). */
export function createReportDiff(
  base: { reportId: string; createdAt: string },
  head: { reportId: string; createdAt: string },
  changes: ReportDiffChange[],
): ReportDiff {
  return {
    diffId: randomUUID(),
    createdAt: new Date().toISOString(),
    baseReportId: base.reportId,
    headReportId: head.reportId,
    baseCreatedAt: base.createdAt,
    headCreatedAt: head.createdAt,
    changes,
  };
}

// Loose on purpose, mirroring `reportSchema` (report.event.ts): consumers of
// persisted diff documents must tolerate additive evolution, so only the
// envelope and each change's discriminator/polarity are structurally
// required.
export const reportDiffSchema = {
  type: 'object',
  nullable: false,
  required: [
    'diffId',
    'createdAt',
    'baseReportId',
    'headReportId',
    'baseCreatedAt',
    'headCreatedAt',
    'changes',
  ],
  additionalProperties: true,
  properties: {
    diffId: { type: 'string', nullable: false },
    createdAt: { type: 'string', nullable: false },
    baseReportId: { type: 'string', nullable: false },
    headReportId: { type: 'string', nullable: false },
    baseCreatedAt: { type: 'string', nullable: false },
    headCreatedAt: { type: 'string', nullable: false },
    changes: {
      type: 'array',
      nullable: false,
      items: {
        type: 'object',
        nullable: false,
        required: ['kind', 'change'],
        additionalProperties: true,
        properties: {
          kind: {
            type: 'string',
            nullable: false,
            enum: ['run-result', 'specification', 'rule'],
          },
          change: {
            type: 'string',
            nullable: false,
            enum: ['added', 'changed', 'removed'],
          },
        },
      },
    },
  },
} as unknown as JSONSchemaType<ReportDiff>;
