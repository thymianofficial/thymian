import type { SerializedThymianFormat } from '../format/index.js';
import type { HttpRequest, HttpResponse } from '../http.js';

/**
 * Severity expresses how important/actionable a finding is for report consumers.
 * CLI exit-code decisions are intentionally not encoded here; consumers decide
 * which severities should be treated as failing for their use case.
 */
export type Severity = 'error' | 'warn' | 'info' | 'hint';

/** Human-readable text that may be rendered by different output channels. */
export interface Message {
  /** Plain text fallback. Every renderer should be able to display this. */
  text: string;
  /** Optional markdown variant for markdown-capable renderers. */
  markdown?: string;
}

/**
 * External or generated file that belongs to a tool run, such as HAR files,
 * screenshots, generated requests, raw logs, or exported diagnostics.
 */
export interface Artifact {
  /** Stable identifier within the report. */
  id: string;
  /** Human-readable description of what the artifact contains. */
  description?: string;
  /** Local filesystem path, when the artifact exists on disk. */
  path?: string;
  /** Remote or virtual URI, when the artifact is not best represented as a path. */
  uri?: string;
  /** ISO timestamp describing when the artifact was created. */
  createdAt?: string;
  /** Media type of the artifact content, if known. */
  mimeType?: string;
}

/** HTTP header bag as represented in report payloads. */
export type Headers = Record<string, string | string[]>;

/** Generic body representation for future report-owned HTTP payloads/artifacts. */
export interface BodyContent {
  /** Textual body content, if it is safe and useful to inline. */
  text?: string;
  /** Base64-encoded body content for binary payloads. */
  binaryBase64?: string;
  /** Media type of the body content. */
  mimeType?: string;
  /** Encoding marker for consumers that need to decode the body. */
  encoding?: 'plain' | 'base64' | (string & {});
}

/** HTTP request shape reused from the core HTTP model. */
export type ReportHttpRequest = HttpRequest;

/** HTTP response shape reused from the core HTTP model. */
export type ReportHttpResponse = HttpResponse;

/**
 * Captured HTTP transaction associated with an execution. It is intentionally
 * attached to executions, not findings, because multiple findings can originate
 * from the same transaction and renderers may decide how much transaction detail
 * to show.
 */
export interface ReportHttpTransaction {
  /** Captured request. */
  request: ReportHttpRequest;
  /** Captured response, if one was received. */
  response?: ReportHttpResponse;
}

/** Metadata describing a rule known to a tool run. */
export interface RuleDescriptor {
  /** Stable rule identifier, e.g. `rfc9110/request-host-header`. */
  id: string;
  /** Optional short display name. */
  name?: string;
  /** Longer rule description. */
  description?: Message;
  /** Default severity for this rule in this run after configuration was applied. */
  severity: Severity;
  /** Short summary suitable for compact output. */
  summary?: Message;
  /** Detailed explanation suitable for verbose output or documentation links. */
  explanation?: Message;
  /** URL with more information or remediation guidance. */
  helpUri?: string;
  /** Relationships to other rules, for example supersedes/depends-on/related-to. */
  relationships?: Array<{
    /** Relationship type. Kept open-ended so rule packages can extend it. */
    kind: string;
    /** Target rule id. */
    targetRuleId: string;
  }>;
}

/** Invocation describes one process/command that contributed to a tool run. */
export interface Invocation {
  /** Optional invocation identifier. */
  id?: string;
  /** Complete command line, when available. */
  commandLine?: string;
  /** Parsed command arguments, when available. */
  arguments?: string[];
  /** Start/end timestamps or monotonic times for duration calculations. */
  duration?: {
    start: number;
    end: number;
  };
  /** Process exit code, when the run executed an external process. */
  exitCode?: number;
  /** Human-readable explanation of the exit code. */
  exitCodeDescription?: string;
  /** Working directory used by the invocation. */
  workingDirectory?: string;
}

/** Relationship between findings, used to model nested causes/composition. */
export interface FindingRelationship {
  /** Related finding. */
  finding: FindingRecord;
  /** Optional explanation of the relationship. */
  description?: string;
  /** Relationship kind. Known values are causal/compositional, but extensible. */
  type: 'caused-by' | 'composed-of' | (string & {});
}

/** Common shape shared by all report findings. */
export interface BaseFinding {
  /** Stable identifier within the report. */
  id: string;
  /** Discriminator describing what kind of fact this finding represents. */
  kind:
    | 'rule-violation'
    | 'rule-success'
    | 'rule-failure'
    | 'rule-skip'
    | 'test-case-pass'
    | 'test-case-fail'
    | 'test-case-skip'
    | 'informational'
    | 'assertion-failure'
    | 'assertion-success'
    | (string & {});
  /** One-line title suitable for compact output. */
  title: string;
  /** Optional longer message. */
  message?: Message;
  /** Severity for prioritization and consumer-specific exit-code decisions. */
  severity: Severity;
  /** Optional related/nested findings for assertions inside test cases, causes, etc. */
  nestedFindings?: FindingRelationship[];
}

/** Rule violation found during lint/test/analyze execution. */
export interface RuleViolationFinding extends BaseFinding {
  kind: 'rule-violation';
  /** Rule that produced this violation. This id refers to an entry in the containing ToolRun.rules list. */
  ruleId: string;
}

/** Positive rule result. Usually hidden in compact CLI output. */
export interface RuleSuccess extends BaseFinding {
  kind: 'rule-success';
  /** Rule that succeeded. This id refers to an entry in the containing ToolRun.rules list. */
  ruleId: string;
}

/** Tool/rule execution failure, distinct from a rule violation in the API. */
export interface RuleFailure extends BaseFinding {
  kind: 'rule-failure';
  /** Rule that failed to execute. This id refers to an entry in the containing ToolRun.rules list. */
  ruleId: string;
}

/** Rule that was skipped intentionally. */
export interface RuleSkip extends BaseFinding {
  kind: 'rule-skip';
  /** Rule that was skipped. This id refers to an entry in the containing ToolRun.rules list. */
  ruleId: string;
  /** Reason the rule was skipped. */
  reason: string;
}

/** Successful assertion result. Usually verbose/debug output only. */
export interface AssertionSuccess extends BaseFinding {
  kind: 'assertion-success';
}

/** Failed assertion with optional expected/actual details. */
export interface AssertionFailure extends BaseFinding {
  kind: 'assertion-failure';
  /** Expected value/shape/status/etc. */
  expected?: unknown;
  /** Actual value/shape/status/etc. */
  actual?: unknown;
}

/** Successful HTTP/API test case result. Usually summary or verbose output only. */
export interface TestCasePass extends BaseFinding {
  kind: 'test-case-pass';
  /** Test case duration in milliseconds, if measured. */
  durationMilliseconds?: number;
}

/** Failed HTTP/API test case result. */
export interface TestCaseFail extends BaseFinding {
  kind: 'test-case-fail';
  /** Test case duration in milliseconds, if measured. */
  durationMilliseconds?: number;
}

/** Skipped HTTP/API test case result. */
export interface TestCaseSkip extends BaseFinding {
  kind: 'test-case-skip';
  /** Reason the case was skipped. */
  reason: string;
}

/** Non-rule informational message collected during execution. */
export interface Informational extends BaseFinding {
  kind: 'informational';
}

/** Any fact collected during a tool run that is relevant for reporting. */
export type FindingRecord =
  | RuleViolationFinding
  | RuleSuccess
  | RuleFailure
  | RuleSkip
  | TestCasePass
  | TestCaseFail
  | TestCaseSkip
  | Informational
  | AssertionFailure
  | AssertionSuccess
  | BaseFinding;

/** Tool/plugin that produced a run. */
export interface Tool {
  /** Tool or plugin package name. */
  name: string;
  /** Tool/plugin version, if known. */
  version?: string;
}

/**
 * Location of an execution. Report locations are references, not denormalized
 * endpoint descriptions. For `thymianFormat` locations, consumers must resolve
 * `elementId`/`elementType` against the `ThymianFormat` instance/serialized
 * format to render endpoint strings.
 */
export type Location =
  | {
      /** References an element from the Thymian format graph. */
      type: 'thymianFormat';
      /** Whether `elementId` references a graph node or graph edge. */
      elementType: 'node' | 'edge';
      /** Graph node/edge id in the Thymian format. */
      elementId: string;
      /** Optional source/schema pointer inside the element. Empty string means the element itself. */
      pointer: string;
    }
  | {
      /** URL location, useful for live endpoints or remote artifacts. */
      type: 'url';
      url: string;
    }
  | {
      /** File location, optionally with line/column. */
      type: 'file';
      path: string;
      line?: number;
      column?: number;
    }
  | {
      /** Fallback/custom location when no structured location exists. */
      type: 'custom';
      value: string;
    };

/**
 * Execution groups findings around a concrete subject which is located via the
 * location property. Executions can be nested to model hierarchies such as
 * endpoint → test case → assertion.
 */
export interface Execution {
  /** Optional display name for this execution group. */
  name?: string;
  /** Optional longer description of what was executed/validated. */
  description?: string;
  /** Subject/location this execution is about. */
  location: Location;
  /** Findings collected for this execution. */
  findings: FindingRecord[];
  /** Nested executions for more detailed grouping. */
  children?: Execution[];
  /** HTTP transactions collected while executing this group. */
  httpTransactions?: ReportHttpTransaction[];
}

/** One run of one tool/plugin for a workflow mode such as lint/test/analyze. */
export interface ToolRun {
  /** Stable identifier for this run within the report. */
  runId: string;
  /** Tool/plugin that produced the data. */
  tool: Tool;
  /** Workflow/run kind. Known core values are lint/test/analyze, but extensible. */
  runType: 'lint' | 'test' | 'analyze' | (string & {});
  /** ISO timestamp when the run was created/started. */
  runAt: string;
  /** Duration in milliseconds, if measured. */
  duration?: number;
  /** Thymian format version/hash used by this run, if known. */
  thymianFormatVersion?: string;
  /** Artifacts produced by this run. */
  artifacts?: Artifact[];
  /** External command/process invocations that contributed to this run. */
  invocations?: Invocation[];
  /** Execution groups produced by this run. Omitted/empty means the plugin collected no reportable information. */
  executions?: Execution[];
  /** List of rules that were checked during this run, including both passed and failed rules. */
  rules?: RuleDescriptor[];
}

/** Root report emitted by core after collecting all plugin tool runs. */
export interface Report {
  /** Stable report identifier. */
  reportId: string;
  /** ISO timestamp when the report was assembled. */
  createdAt: string;
  /** Tool runs with collected information. A single plugin may contribute multiple tool runs. */
  runs: ToolRun[];
  /** Serialized format used by the workflow, if available, for resolving thymianFormat locations during rendering. */
  thymianFormat?: SerializedThymianFormat;
}
