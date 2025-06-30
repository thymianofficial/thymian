import type { RuleSeverity } from './rule-severity.js';

export type IntermediaryRole = 'intermediary' | 'proxy' | 'gateway' | 'tunnel';

export type HttpParticipantRole =
  | IntermediaryRole
  | 'origin server'
  | 'client'
  | 'cache';

export type RuleType = 'static' | 'analytics' | 'test' | 'informational';

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
  summary?: string;
  url?: string;
};
