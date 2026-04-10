import type { JSONSchemaType } from 'ajv/dist/2020.js';

/**
 * Severity levels for report items.
 *
 * **Mapping from {@link import('../rules/rule-severity.js').RuleSeverity RuleSeverity}:**
 * - `RuleSeverity 'error'` → `ThymianReportSeverity 'error'`
 * - `RuleSeverity 'warn'`  → `ThymianReportSeverity 'warn'`
 * - `RuleSeverity 'hint'`  → `ThymianReportSeverity 'hint'`
 * - `RuleSeverity 'off'`   → never produces report items (filtered by the rule runner)
 *
 * **Non-rule informational items:**
 * - `'info'` is reserved for operational/informational items that originate
 *   from direct report emission (e.g., skipped test cases) rather than from
 *   rule evaluation. There is no corresponding `RuleSeverity` value.
 */
export type ThymianReportSeverity = 'info' | 'hint' | 'warn' | 'error';

/**
 * Location information for a report item or section.
 *
 * Supports the location semantics for all three validation contexts:
 * - **lint**: `file` carries spec file path/URI and position within the document.
 * - **test**: `format` carries the graph element (node/edge) that identifies the
 *   endpoint or request path under test.
 * - **analyze**: `format` carries the graph element for the traffic analysis context,
 *   optionally combined with `file` when traffic has a source file.
 *
 * Both sub-objects are optional and may coexist on the same location.
 */
export interface ThymianReportLocation {
  file?: {
    path?: string;
    uri?: string;
    position?: { line: number; column: number; offset: number };
  };
  format?: {
    elementType: 'node' | 'edge';
    elementId: string;
  };
}

/**
 * A single finding or informational item within a report section.
 *
 * Items produced by the rule-violation pipeline (via `createReportFromViolations`)
 * always carry `ruleName` sourced from {@link import('../rules/rule-violation.js').EvaluatedRuleViolation EvaluatedRuleViolation}.
 *
 * Items produced by direct report emission (via `ctx.report()`) may omit
 * `ruleName` when they represent operational status rather than rule findings
 * (e.g., skipped or failed test cases).
 */
export interface ThymianReportItem {
  severity: ThymianReportSeverity;
  message: string;
  /** Stable rule identifier. Present for rule-originated findings; may be absent for operational/informational items. */
  ruleName?: string;
  details?: string;
  links?: { title?: string; url: string }[];
  location?: ThymianReportLocation;
}

/**
 * A group of related report items under a common heading.
 *
 * In the standard violation pipeline, headings are derived from the resolved
 * violation location (e.g., "GET /users → 200 OK").
 */
export interface ThymianReportSection {
  heading: string;
  items: ThymianReportItem[];
  location?: ThymianReportLocation;
}

/**
 * The canonical shared report model for all validation contexts.
 *
 * `ThymianReport` is the formatter-agnostic representation of validation
 * findings emitted through the `core.report` event. All lint, test, and
 * analyze workflows produce results through this single model before any
 * formatter-specific rendering occurs.
 *
 * - `source` identifies the producing plugin.
 * - `message` provides a human-readable summary of the validation run.
 * - `sections` groups findings by location heading.
 * - `metadata` carries optional context-specific information (e.g., validation
 *   mode, config source) without polluting the core model structure.
 *
 * Formatters (text, markdown, CSV) translate this model into presentation
 * output. Renderer differences are limited to styling, grouping, and stream
 * routing — not validation meaning.
 */
export interface ThymianReport {
  source: string;
  message: string;
  sections?: ThymianReportSection[];
  metadata?: Record<string, unknown>;
}

export type ReportFn = (report: ThymianReport) => void;

export type ReportEvent = ThymianReport;

const thymianReportLocationSchema = {
  type: 'object',
  nullable: true,
  additionalProperties: false,
  properties: {
    file: {
      type: 'object',
      nullable: true,
      additionalProperties: false,
      properties: {
        path: { type: 'string', nullable: true },
        uri: { type: 'string', nullable: true },
        position: {
          type: 'object',
          nullable: true,
          additionalProperties: false,
          required: ['line', 'column', 'offset'] as const,
          properties: {
            line: { type: 'integer', nullable: false },
            column: { type: 'integer', nullable: false },
            offset: { type: 'integer', nullable: false },
          },
        },
      },
    },
    format: {
      type: 'object',
      nullable: true,
      additionalProperties: false,
      required: ['elementType', 'elementId'] as const,
      properties: {
        elementType: {
          type: 'string',
          enum: ['node', 'edge'],
          nullable: false,
        },
        elementId: { type: 'string', nullable: false },
      },
    },
  },
} as const;

const thymianReportItemSchema = {
  type: 'object',
  nullable: false,
  additionalProperties: false,
  required: ['severity', 'message'] as const,
  properties: {
    severity: {
      type: 'string',
      enum: ['info', 'hint', 'warn', 'error'],
      nullable: false,
    },
    message: { type: 'string', nullable: false },
    ruleName: { type: 'string', nullable: true },
    details: { type: 'string', nullable: true },
    links: {
      type: 'array',
      nullable: true,
      items: {
        type: 'object',
        nullable: false,
        required: ['url'] as const,
        additionalProperties: false,
        properties: {
          title: { type: 'string', nullable: true },
          url: { type: 'string', nullable: false },
        },
      },
    },
    location: thymianReportLocationSchema,
  },
} as const;

const thymianReportSectionSchema = {
  type: 'object',
  nullable: false,
  additionalProperties: false,
  required: ['heading', 'items'] as const,
  properties: {
    heading: { type: 'string', nullable: false },
    items: {
      type: 'array',
      nullable: false,
      items: thymianReportItemSchema,
    },
    location: thymianReportLocationSchema,
  },
} as const;

export const thymianReportSchema: JSONSchemaType<ReportEvent> = {
  type: 'object',
  nullable: false,
  additionalProperties: false,
  required: ['source', 'message'],
  properties: {
    source: { type: 'string', nullable: false },
    message: { type: 'string', nullable: false },
    sections: {
      type: 'array',
      nullable: true,
      items: thymianReportSectionSchema,
    },
    metadata: {
      type: 'object',
      nullable: true,
      required: [] as const,
      additionalProperties: true,
    },
  },
} as unknown as JSONSchemaType<ReportEvent>;
