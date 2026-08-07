/**
 * The supported Spectral input: the JSON array produced by
 * `spectral lint -f json` (`@stoplight/spectral-cli`).
 *
 * Field set as emitted by Spectral's `json` formatter: `code`, `path`,
 * `message`, `severity`, `range`, `source`, plus `documentationUrl` only when
 * the rule declares one. Verified against real Spectral 6 output.
 *
 * - `range` positions are **0-based** (lines and characters).
 * - `severity` numbers are DiagnosticSeverity: 0=error, 1=warning,
 *   2=information, 3=hint.
 * - Unknown extra fields are tolerated (forward-compatible); unknown severity
 *   numbers convert conservatively to `error` with a warning — findings are
 *   never dropped.
 */
export interface SpectralResult {
  /** Rule identifier; Spectral allows numeric codes — stringified on mapping. */
  code: string | number;
  message: string;
  /** DiagnosticSeverity: 0=error, 1=warning, 2=information, 3=hint. */
  severity: number;
  /** JSON path segments of the offending document location. */
  path: (string | number)[];
  /** 0-based document range of the finding. */
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  /** Source file the finding refers to, when Spectral knows it. */
  source?: string;
  /** Rule documentation link, present only when the rule declares one. */
  documentationUrl?: string;
}
