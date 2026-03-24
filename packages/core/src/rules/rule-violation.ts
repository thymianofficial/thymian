import type { RuleSeverity } from './rule-severity.js';

export type RuleViolationLocation =
  | {
      elementType: 'node' | 'edge';
      elementId: string;
      pointer?: string;
      label?: string;
    }
  | string;

export type RuleViolation = {
  rule?: string;
  severity?: Exclude<RuleSeverity, 'off'>;
  location: RuleViolationLocation;
  message?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
};

export type RuleFnResult = undefined | RuleViolation | RuleViolation[];
