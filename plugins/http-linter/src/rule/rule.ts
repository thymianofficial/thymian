import type { AnalyticsApiContext } from '../api-context/analytics-api-context.js';
import type { ApiContext } from '../api-context/api-context.js';
import type { HttpTestApiContext } from '../api-context/http-test-api-context.js';
import type { StaticApiContext } from '../api-context/static-api-context.js';
import type { RuleFn } from './rule-fn.js';
import type { RuleMeta, RuleType } from './rule-meta.js';

//export function isStaticRule

export type Rule<
  Options extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>
> = {
  staticRule?: RuleFn<StaticApiContext, Options>;
  analyticsRule?: RuleFn<AnalyticsApiContext, Options>;
  testRule?: RuleFn<HttpTestApiContext, Options>;
  meta: RuleMeta;
};
