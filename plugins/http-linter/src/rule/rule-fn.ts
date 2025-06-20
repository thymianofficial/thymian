import type { Logger } from '@thymian/core';

import type { ApiContext } from '../api-context/api-context.js';
import type { RuleType } from './rule-meta.js';
import type { RuleViolation } from './rule-violation.js';

export type RuleFnResult = RuleViolation | RuleViolation[];

export type RuleFn<
  Context extends ApiContext,
  Options extends Record<PropertyKey, unknown>
> = (
  context: Context,
  options: Options & { mode: RuleType },
  logger: Logger
) => RuleFnResult | Promise<RuleFnResult>;
