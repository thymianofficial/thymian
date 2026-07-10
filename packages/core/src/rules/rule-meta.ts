import type { JSONSchemaType } from '../ajv.js';
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

// Captured traffic stores one concrete role per message and repositories match
// role names exactly, so umbrella roles must be expanded to every concrete
// role they subsume before filtering. 'server' covers every participant that
// can receive and respond to requests; 'client' covers every participant that
// originates requests.
const httpParticipantRoleHierarchy: Partial<
  Record<HttpParticipantRole, readonly HttpParticipantRole[]>
> = {
  server: [
    'server',
    'origin server',
    'cache',
    'proxy',
    'gateway',
    'tunnel',
    'intermediary',
  ],
  client: ['client', 'user-agent'],
  intermediary: ['intermediary', 'proxy', 'gateway', 'tunnel'],
};

export function expandHttpParticipantRoles(
  roles: readonly HttpParticipantRole[],
): HttpParticipantRole[] {
  return [
    ...new Set(
      roles.flatMap((role) => httpParticipantRoleHierarchy[role] ?? [role]),
    ),
  ];
}

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
