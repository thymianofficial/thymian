import type { RuleSeverity } from './rule-severity.js';

export type IntermediaryRole = 'intermediary' | 'proxy' | 'gateway' | 'tunnel';

export type HttpParticipantRole =
  | IntermediaryRole
  | 'origin server'
  | 'user agent'
  | 'cache';

export type RuleType = 'static' | 'analytics' | 'test';

export type RuleMeta = {
  name: string;
  type: RuleType[];
  options: Record<string, unknown>;
  severity: RuleSeverity;
  appliesTo?: HttpParticipantRole[];
  tags?: string[];
  explanation?: string;
  description?: string;
  recommendation?: string;
  url?: string;
};
