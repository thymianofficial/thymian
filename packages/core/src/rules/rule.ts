import type { AnalyzeContext, LintContext, TestContext } from './contexts.js';
import type { RuleFn } from './rule-fn.js';
import type { RuleMeta } from './rule-meta.js';

export type Rule<
  Options extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>,
> = {
  lintRule?: RuleFn<LintContext, Options>;
  analyzeRule?: RuleFn<AnalyzeContext, Options>;
  testRule?: RuleFn<TestContext, Options>;
  meta: RuleMeta<Options>;
};
