import type { Logger } from '../logger/logger.js';
import type { ApiContext } from './contexts.js';
import type { RuleFnResult } from './rule-violation.js';

export type RuleFn<
  Context extends ApiContext,
  Options extends Record<PropertyKey, unknown>,
> = (
  context: Context,
  options: Options & { mode: 'static' | 'analytics' | 'test' },
  logger: Logger,
) => RuleFnResult | Promise<RuleFnResult>;
