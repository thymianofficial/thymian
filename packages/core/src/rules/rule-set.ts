import type { Rule } from './rule.js';
import type { RulesConfiguration } from './rule-configuration.js';
import type { CoverageRecord } from './rule-coverage.js';

export type RuleSet = {
  name: string;
  url?: string;
  options?: Record<string, unknown>;
  rules?: Rule[];
  pattern?: string | string[];
  profiles?: Record<string, RulesConfiguration>;
  // Populated from the package's own `coverage.ts` module — a **spec**
  // package's denominator/numerator record (ADR-0021 §5). Optional: a
  // self-referential package (one with no external document to be partial
  // against) carries none. No `kind` field distinguishes the two; the
  // property's presence already does.
  coverage?: CoverageRecord;
};
