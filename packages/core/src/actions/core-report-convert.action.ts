import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { SerializedThymianFormat } from '../format/index.js';
import type { ThymianFormatVersion, ToolRun } from '../report/index.js';
import type { Action } from './action.js';

/**
 * A typed report input, e.g. `--report some-tool:./report.json`. Same shape
 * as {@link SpecificationInput} but defined independently — the two contracts
 * evolve separately (ADR-0017).
 */
export interface ReportInput {
  type: string;
  location: unknown;
  options?: Record<string, unknown>;
}

export interface CoreReportConvertInput {
  inputs: ReportInput[];
  format?: SerializedThymianFormat;
  options?: Record<string, unknown>;
}

/**
 * One listener's reply for one claimed {@link ReportInput}. Listeners on
 * `core.report.convert` reply an array of these — one entry per input they
 * claim, tagged with that input's identity so core can assemble runs in
 * input order and derive claim coverage (ADR-0016). `location` in the tag is
 * always the *stringified* input location, matching the identity
 * normalization `Thymian.reportConvert()` uses to match fragments back to
 * inputs (mirrors `validate()`'s `String(specification.location)` pattern).
 */
export interface ConvertedRunFragment {
  input: { type: string; location: string };
  run: ToolRun;
  /**
   * Serialized formats used by `run`, keyed by format hash — the same shape
   * as `Report.thymianFormat`. Listeners whose input already carries format
   * maps (e.g. a persisted Thymian report, #507) pass them through here so
   * `thymianFormat`-typed locations stay resolvable in the assembled report;
   * `Thymian.reportConvert()` unions all fragment maps by hash (first
   * occurrence wins — equal hashes mean equal graphs).
   */
  thymianFormat?: Record<ThymianFormatVersion, SerializedThymianFormat>;
  /**
   * Identity of the source report this run was read from, when the claimed
   * input *is* a persisted report (the `thymian:` claim, #502). Foreign
   * converters have no source-report identity and omit it. Consumers that
   * need per-report attribution (`Thymian.reportDiff()`: `baseReportId`/
   * `baseCreatedAt`) read it; `Thymian.reportConvert()` ignores it.
   */
  report?: { reportId: string; createdAt: string };
}

/**
 * Core-owned `report convert` collect action (ADR-0016/0017).
 *
 * Listener contract (converter plugins register on `core.report.convert`):
 * - Payload: `{ inputs, format?, options? }`; reply
 *   {@link ConvertedRunFragment}`[]` — one entry per claimed input.
 * - A listener that converts a claimed input *against* the handed `format`
 *   must tag the produced run with it (`thymianFormatVersion =
 *   format.attributes.hash`) — the tag is the only signal core has that the
 *   workflow format was used. Core cannot complete a missing tag at assembly:
 *   across merge inputs an untagged run is indistinguishable from one
 *   converted without the format, and guessing would attribute a graph the
 *   run may never have used. An untagged run keeps the format out of the
 *   assembled report and renders format references as raw
 *   `format:<elementId>` text.
 * - Reply even when nothing is claimed (`ctx.reply([])`) — the `'collect'`
 *   strategy waits for a reply from every registered listener, and a silent
 *   listener times the whole action out.
 * - Throw (don't reply) on a malformed/unsupported claimed input; the thrown
 *   error propagates as a workflow failure (tool/runtime error), it does not
 *   turn into an unclaimed input.
 */
export type ReportConvertAction = Action<
  CoreReportConvertInput,
  ConvertedRunFragment[]
>;

// Mirrors `specificationInputSchema` (format-load.action.ts): `location` is
// `unknown`, hence the empty (accept-anything) sub-schema.
export const reportInputSchema = {
  type: 'object',
  nullable: false,
  required: ['type', 'location'],
  additionalProperties: false,
  properties: {
    type: { type: 'string', nullable: false },
    location: {},
    options: {
      type: 'object',
      required: [],
      additionalProperties: true,
    },
  },
} as unknown as JSONSchemaType<ReportInput>;

// `as unknown as JSONSchemaType<…>` is load-bearing here (not stylistic): it
// composes the pre-cast `reportInputSchema` (itself `unknown`-cast because
// `location` is `unknown`) and leaves `format` deliberately untyped (`{}`,
// like `location` above) since `SerializedThymianFormat` isn't usefully
// representable as a JSON Schema — a single `as` cannot verify either.
//
// Optional properties are NOT `nullable`: the type never allows `null` for
// them (a field is skipped by omission), matching the newer
// `core-workflow.action.ts` idiom rather than the older `nullable: true`
// convention in `format-load.action.ts`.
export const coreReportConvertActionSchema = {
  type: 'object',
  nullable: false,
  required: ['inputs'],
  additionalProperties: false,
  properties: {
    inputs: {
      type: 'array',
      nullable: false,
      items: reportInputSchema,
    },
    format: {},
    options: {
      type: 'object',
      required: [],
      additionalProperties: true,
    },
  },
} as unknown as JSONSchemaType<CoreReportConvertInput>;

// The `run` field is validated loosely, like `toolRunArraySchema`'s items:
// the same required-field set (`runId`/`tool`/`runType`/`runAt`) plus
// `executions` checked as an array when present, everything else accepted
// via `additionalProperties: true`.
export const convertedRunFragmentArraySchema = {
  type: 'array',
  nullable: false,
  items: {
    type: 'object',
    nullable: false,
    required: ['input', 'run'],
    additionalProperties: false,
    properties: {
      input: {
        type: 'object',
        nullable: false,
        required: ['type', 'location'],
        additionalProperties: false,
        properties: {
          type: { type: 'string', nullable: false },
          location: { type: 'string', nullable: false },
        },
      },
      // Same shape as `Report.thymianFormat`: a hash-keyed map of serialized
      // formats; the values aren't usefully expressible as JSON Schema (see
      // `format` above), so only the container is checked. Optional by
      // omission, not `nullable`.
      thymianFormat: {
        type: 'object',
        required: [],
        additionalProperties: true,
      },
      // Source-report identity (see the interface docs). Optional by
      // omission, not `nullable`.
      report: {
        type: 'object',
        required: ['reportId', 'createdAt'],
        additionalProperties: true,
        properties: {
          reportId: { type: 'string', nullable: false },
          createdAt: { type: 'string', nullable: false },
        },
      },
      run: {
        type: 'object',
        nullable: false,
        required: ['runId', 'tool', 'runType', 'runAt'],
        additionalProperties: true,
        properties: {
          runId: { type: 'string', nullable: false },
          runType: { type: 'string', nullable: false },
          runAt: { type: 'string', nullable: false },
          tool: {
            type: 'object',
            nullable: false,
            required: ['name'],
            additionalProperties: true,
            properties: {
              name: { type: 'string', nullable: false },
              version: { type: 'string', nullable: true },
            },
          },
          executions: {
            type: 'array',
            nullable: true,
            items: {} as JSONSchemaType<unknown>,
          },
        },
      },
    },
  },
} as unknown as JSONSchemaType<ConvertedRunFragment[]>;
