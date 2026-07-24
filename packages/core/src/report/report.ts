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
 *
 * Reserved public surface: referenced by {@link ToolRun.artifacts} but not yet
 * populated by any producer. Kept as an intentional extension point.
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

/** HTTP request shape reused from the core HTTP model. */
export type ReportHttpRequest = HttpRequest;

/** HTTP response shape reused from the core HTTP model. */
export type ReportHttpResponse = HttpResponse;

/**
 * Captured HTTP transaction collected while running a test. Transactions are
 * attached at {@link TestStep} granularity (see {@link TestStep.httpTransactions}),
 * not to individual findings, because multiple findings can originate from the
 * same transaction and renderers may decide how much transaction detail to show.
 * A finding may point at a specific transaction within its step via
 * {@link BaseFinding.transactionIndex}.
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

/**
 * Invocation describes one process/command that contributed to a tool run.
 *
 * Reserved public surface: the model carries it and {@link ToolRun.invocations}
 * references it, but no producer populates it yet. Kept (not removed) as an
 * intentional SARIF-parity extension point for capturing CLI/process invocation
 * detail in a future story.
 */
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

/**
 * Common shape shared by all report findings.
 *
 * Findings represent *detail* collected during an execution. Rule/test outcomes
 * ("violation"/"passed"/"skipped") are no longer findings — they live on the
 * owning {@link Execution}'s {@link ExecutionStatus}. Findings therefore carry
 * neither a `severity` (a violation's severity is derived from its execution's
 * `ruleId`/`status`) nor a `ruleId` (a finding inherits its execution's rule).
 */
export interface BaseFinding {
  /** Stable identifier within the report. */
  id: string;
  /**
   * Discriminator describing what kind of fact this finding represents. Kept
   * open (`string & {}`) so producers can emit custom finding kinds; consumers
   * should handle unknown kinds gracefully.
   */
  kind:
    | 'rule-violation'
    | 'informational'
    | 'assertion-failure'
    | 'assertion-success'
    | (string & {});
  /** One-line title suitable for compact output. */
  title: string;
  /** Optional longer message. */
  message?: Message;
  /**
   * Zero-based index into the owning {@link TestStep.httpTransactions} of the
   * transaction this finding is about, when it is tied to a specific transaction.
   * Lets a consumer trace a finding (e.g. an assertion failure or an invalid
   * transaction) back to the exact HTTP exchange. Undefined when no single
   * transaction applies (e.g. lint/analyze findings, or step-wide findings).
   */
  transactionIndex?: number;
}

/**
 * Rule violation detail retained at *step* granularity in the tester so a failed
 * step stays visible. Rule attribution is intentionally not represented here —
 * the owning {@link TestCaseExecution}'s `ruleId` identifies the rule.
 */
export interface RuleViolationFinding extends BaseFinding {
  kind: 'rule-violation';
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

/** Non-rule informational message collected during execution. */
export interface Informational extends BaseFinding {
  kind: 'informational';
}

/** Any fact collected during a tool run that is relevant for reporting. */
export type FindingRecord =
  | RuleViolationFinding
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
 * Outcome of an execution — a SARIF-`result`-like `kind` (outcome) that is kept
 * separate from severity (which, per SARIF, only applies to `failed`). `failed`
 * ≡ a rule violation; `skipped` ≡ an execution that did not run (e.g. its rule
 * opted out).
 */
export type ExecutionStatus =
  | {
      kind: 'passed';
      /** Execution duration in milliseconds, if measured. */
      durationMilliseconds?: number;
    }
  | {
      kind: 'failed';
      /** Custom violation/failure message; renderers fall back to the rule when absent. */
      reason?: string;
      /** Execution duration in milliseconds, if measured. */
      durationMilliseconds?: number;
      /**
       * Overrides the rule's configured severity for this specific failure.
       * When absent, severity is resolved from the execution's `ruleId`. MUST
       * only be set on `failed` status.
       */
      severity?: Severity;
    }
  | {
      kind: 'skipped';
      /** Reason the execution was skipped. */
      reason?: string;
    };

/**
 * Abstract base for every execution. An execution is a rule evaluated against a
 * subject, producing an outcome ({@link ExecutionStatus}) — modelled after a
 * SARIF `result`. Concrete shapes are selected by the closed `kind` discriminator.
 */
export interface ExecutionBase {
  /** Discriminator selecting the concrete execution type / run type. */
  kind: 'lint' | 'test' | 'analyze';
  /**
   * Rule this execution evaluated. Optional to support future generic/ruleless
   * runners; for thymian lint/analyze/test it is always set.
   */
  ruleId?: string;
  /** Outcome of the execution. */
  status: ExecutionStatus;
}

/** Lint execution: one rule evaluated against one location. */
export interface LintExecution extends ExecutionBase {
  kind: 'lint';
  /** Subject/location this execution is about. */
  location: Location;
  /** Detail findings (assertion/informational). Empty in the common passing case. */
  findings: FindingRecord[];
}

/**
 * Analyze execution: identical shape to {@link LintExecution} today (distinct
 * `kind` tag). `httpTransactions` evidence is a future tailoring point.
 */
export interface AnalyzeExecution extends ExecutionBase {
  kind: 'analyze';
  /** Subject/location this execution is about. */
  location: Location;
  /** Detail findings (assertion/informational). Empty in the common passing case. */
  findings: FindingRecord[];
}

/** A single step of a test case; findings live here, not on the test execution. */
export interface TestStep {
  /** Display name of the step. */
  name: string;
  /** Subject/location this step is about. */
  location: Location;
  /** Findings collected for this step (assertion/informational/rule-violation). */
  findings: FindingRecord[];
  /** HTTP transactions collected while executing this step. */
  httpTransactions?: ReportHttpTransaction[];
}

/** Test execution: maps to one test case and carries its steps. */
export interface TestCaseExecution extends ExecutionBase {
  kind: 'test';
  /** Test case name. */
  name: string;
  /** Steps of the test case. Findings live on the steps. */
  steps: TestStep[];
}

/**
 * A single execution produced by a tool run. Non-recursive, per-run-type, over a
 * shared {@link ExecutionBase}. There is no `children` nesting: a run is a flat
 * list of leaf executions.
 */
export type Execution = LintExecution | TestCaseExecution | AnalyzeExecution;

/**
 * Fields shared by every {@link ToolRun}, independent of its run type. The
 * discriminating `runType` and the type-correlated `executions` are added per
 * arm of the {@link ToolRun} union.
 */
export interface ToolRunBase {
  /** Stable identifier for this run within the report. */
  runId: string;
  /** Tool/plugin that produced the data. */
  tool: Tool;
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
  /** List of rules that were checked during this run, including both passed and failed rules. */
  rules?: RuleDescriptor[];
}

/**
 * One run of one tool/plugin for a workflow mode such as lint/test/analyze.
 *
 * Modelled as a discriminated union on `runType`: the run kind fixes the
 * concrete execution type, so a `lint` run can only carry {@link LintExecution}s,
 * a `test` run only {@link TestCaseExecution}s, and an `analyze` run only
 * {@link AnalyzeExecution}s. This makes it impossible to attach executions whose
 * `kind` disagrees with the run's `runType`. `executions` omitted/empty means the
 * plugin collected no reportable information.
 */
export type ToolRun =
  | (ToolRunBase & { runType: 'lint'; executions?: LintExecution[] })
  | (ToolRunBase & { runType: 'test'; executions?: TestCaseExecution[] })
  | (ToolRunBase & { runType: 'analyze'; executions?: AnalyzeExecution[] });

/** Version/hash identifying a specific serialized Thymian format. */
export type ThymianFormatVersion = string;

/** Root report emitted by core after collecting all plugin tool runs. */
export interface Report {
  /** Stable report identifier. */
  reportId: string;
  /** ISO timestamp when the report was assembled. */
  createdAt: string;
  /** Tool runs with collected information. A single plugin may contribute multiple tool runs. */
  runs: ToolRun[];
  /**
   * Serialized formats used by the runs in this report, keyed by version, for
   * resolving `thymianFormat` locations during rendering. A run selects its
   * format via `ToolRun.thymianFormatVersion`.
   */
  thymianFormat?: Record<ThymianFormatVersion, SerializedThymianFormat>;
}
