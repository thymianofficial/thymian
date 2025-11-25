import type { JSONSchemaType } from '@thymian/core/ajv';

import type { RuleSeverity } from './rule-severity.js';

export const httpParticipantRoles = [
  'intermediary',
  'proxy',
  'gateway',
  'tunnel',
  'origin server',
  'server',
  'client',
  'user-agent',
  'cache',
] as const;

export type HttpParticipantRole = (typeof httpParticipantRoles)[number];

export const ruleTypes = [
  'static',
  'analytics',
  'test',
  'informational',
] as const;

export type RuleType = (typeof ruleTypes)[number];

export type RuleMeta<Options = unknown> = {
  name: string;
  type: RuleType[];
  options: JSONSchemaType<Options>;
  severity: RuleSeverity;
  appliesTo?: HttpParticipantRole[];
  tags?: string[];
  explanation?: string;
  description?: string;
  recommendation?: string;
  summary?: string;
  url?: string;
};
