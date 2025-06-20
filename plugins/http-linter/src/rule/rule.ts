import type { AnalyticsApiContext } from '../api-context/analytics-api-context.js';
import type { ApiContext } from '../api-context/api-context.js';
import type { StaticApiContext } from '../api-context/static-api-context.js';
import type { TestApiContext } from '../api-context/test-api-context.js';
import type { RuleFn } from './rule-fn.js';
import type { RuleMeta } from './rule-meta.js';

export type Rule<
  Options extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>
> = {
  rule?: RuleFn<ApiContext, Options>;
  staticRule?: RuleFn<StaticApiContext, Options>;
  analyticsRule?: RuleFn<AnalyticsApiContext, Options>;
  testRule?: RuleFn<TestApiContext, Options>;
  meta: RuleMeta;
};
