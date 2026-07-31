import type { JSONSchemaType } from 'ajv';

import type {
  AnalyzeContext,
  ApiContext,
  LintContext,
  LiveApiContext,
  TestContext,
} from './contexts.js';
import type { Rule } from './rule.js';
import {
  checkRuleExecutionInvariant,
  describeRuleExecutionInvariantViolation,
  ruleFnPropertyByType,
} from './rule-execution-invariant.js';
import type { RuleFn } from './rule-fn.js';
import type { HttpParticipantRole, RuleType } from './rule-meta.js';
import { isRuleSeverityLevel, type RuleSeverity } from './rule-severity.js';

type ApiContextType<RuleTypes extends [RuleType, ...RuleType[]]> =
  RuleTypes[number] extends 'static'
    ? LintContext
    : RuleTypes[number] extends 'analytics'
      ? AnalyzeContext
      : RuleTypes[number] extends 'test'
        ? TestContext
        : RuleTypes[number] extends 'analytics' | 'test'
          ? LiveApiContext
          : ApiContext;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isInformationalRule<R extends Rule<any>>(
  rule: R,
): rule is R & { meta: { type: ['informational'] } } {
  return rule.meta.type.includes('informational');
}

interface DefineRuleSeverity {
  severity(severity: RuleSeverity): DefineRuleType;
}

interface InformationalMixedWithExecutableTypes {
  readonly "'informational' cannot be combined with executable rule types": unknown;
}

type DefineRuleTypeResult<Types extends [RuleType, ...RuleType[]]> =
  'informational' extends Types[number]
    ? [Exclude<Types[number], 'informational'>] extends [never]
      ? DefineOptionalRuleMetaProperties<Types>
      : InformationalMixedWithExecutableTypes
    : DefineOptionalRuleMetaProperties<Types>;

interface DefineRuleType {
  type<Types extends [RuleType, ...RuleType[]]>(
    ...types: Types
  ): DefineRuleTypeResult<Types>;
}

interface MissingExecutionFunctionForTypes<Missing extends RuleType> {
  readonly 'Cannot finish this rule: no execution function is defined for declared rule type(s)': Missing;
}

// 'done' is only callable once every declared executable type is covered by
// .rule() or the matching .override*Rule(); otherwise it resolves to a
// non-callable marker type that names the uncovered types in the compile
// error. Informational rules have nothing to cover.
type DefineDone<
  RuleTypes extends [RuleType, ...RuleType[]],
  Options extends Record<PropertyKey, unknown>,
  Covered extends RuleType,
> = [Exclude<RuleTypes[number], Covered | 'informational'>] extends [never]
  ? () => Rule<Options>
  : MissingExecutionFunctionForTypes<
      Exclude<RuleTypes[number], Covered | 'informational'>
    >;

interface DefineRules<
  RuleTypes extends [RuleType, ...RuleType[]],
  Options extends Record<PropertyKey, unknown>,
  Covered extends RuleType = never,
> {
  done: DefineDone<RuleTypes, Options, Covered>;

  rule(
    fn: RuleTypes extends ['informational']
      ? never
      : RuleFn<ApiContextType<RuleTypes>, Options>,
  ): DefineRules<RuleTypes, Options, RuleTypes[number]>;

  overrideAnalyticsRule(
    fn: RuleTypes extends ['informational']
      ? never
      : RuleFn<AnalyzeContext, Options>,
  ): DefineRules<RuleTypes, Options, Covered | 'analytics'>;

  overrideStaticRule(
    fn: RuleTypes extends ['informational']
      ? never
      : RuleFn<LintContext, Options>,
  ): DefineRules<RuleTypes, Options, Covered | 'static'>;

  overrideTest(
    fn: RuleTypes extends ['informational']
      ? never
      : RuleFn<TestContext, Options>,
  ): DefineRules<RuleTypes, Options, Covered | 'test'>;
}

interface DefineOptionalRuleMetaProperties<
  RuleTypes extends [RuleType, ...RuleType[]],
  Options extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>,
> extends DefineRules<RuleTypes, Options> {
  appliesTo(
    ...participants: [HttpParticipantRole, ...HttpParticipantRole[]]
  ): this;

  description(
    description: string,
  ): DefineOptionalRuleMetaProperties<RuleTypes, Options>;

  summary(
    summary: string,
  ): DefineOptionalRuleMetaProperties<RuleTypes, Options>;

  url(url: string): this;

  tags(...tags: string[]): DefineOptionalRuleMetaProperties<RuleTypes, Options>;

  explanation(
    explanation: string,
  ): DefineOptionalRuleMetaProperties<RuleTypes, Options>;

  options<Options extends Record<PropertyKey, unknown>>(
    schema: JSONSchemaType<Options>,
  ): DefineOptionalRuleMetaProperties<RuleTypes, Options>;
}

class RuleBuilder<
  Options extends Record<PropertyKey, unknown>,
  RuleTypes extends [RuleType, ...RuleType[]],
>
  implements DefineRuleType, DefineRuleSeverity
{
  readonly #rule: Rule<Options>;

  constructor(name: string) {
    this.#rule = {
      meta: {
        severity: 'off',
        tags: [],
        name: name.trim(),
        type: ['static', 'analytics', 'test'],
        options: {} as JSONSchemaType<Options>,
      },
    };
  }

  type<Types extends [RuleType, ...RuleType[]]>(
    ...types: Types
  ): DefineRuleTypeResult<Types> {
    this.#rule.meta.type = types;

    // Execution functions are defined after .type(), so a missing execution
    // function is expected here; every other violation (malformed or unknown
    // types, informational mixed with executable types) is final.
    const violation = checkRuleExecutionInvariant(this.#rule);

    if (violation && violation.reason !== 'missing-execution-function') {
      throw new Error(
        describeRuleExecutionInvariantViolation(this.#rule.meta.name, violation)
          .message,
      );
    }

    return this as unknown as DefineRuleTypeResult<Types>;
  }

  appliesTo(
    ...participants: [HttpParticipantRole, ...HttpParticipantRole[]]
  ): this {
    this.#rule.meta.appliesTo = participants;
    return this;
  }

  description(description: string): this {
    this.#rule.meta.description = description.trim();
    return this;
  }

  summary(summary: string): this {
    this.#rule.meta.summary = summary.trim();
    return this;
  }

  url(url: string): this {
    this.#rule.meta.url = url.trim();
    return this;
  }

  tags(...tags: string[]): this {
    this.#rule.meta.tags = tags;
    return this;
  }

  explanation(explanation: string): this {
    this.#rule.meta.explanation = explanation.trim();
    return this;
  }

  options<Opts extends Record<PropertyKey, unknown>>(
    schema: JSONSchemaType<Opts>,
  ): DefineOptionalRuleMetaProperties<RuleTypes, Opts> {
    this.#rule.meta.options = schema as JSONSchemaType<Options>;

    return this as unknown as DefineOptionalRuleMetaProperties<RuleTypes, Opts>;
  }

  severity(severity: RuleSeverity): DefineRuleType {
    if (!isRuleSeverityLevel(severity)) {
      throw new Error('Invalid rule severity.');
    }
    this.#rule.meta.severity = severity;

    return this as DefineRuleType;
  }

  rule(
    fn: RuleTypes extends ['informational']
      ? never
      : RuleFn<ApiContextType<RuleTypes>, Options>,
  ): DefineRules<RuleTypes, Options, RuleTypes[number]> {
    if (isInformationalRule(this.#rule)) {
      throw new Error('Cannot define rule function for this type of rule.');
    }

    for (const type of this.#rule.meta.type) {
      if (type !== 'informational') {
        this.#rule[ruleFnPropertyByType[type]] = fn;
      }
    }

    return this as unknown as DefineRules<
      RuleTypes,
      Options,
      RuleTypes[number]
    >;
  }

  // The class methods back every chain state, so their declared Covered is
  // the widest one (fully covered); the narrowing per state happens in the
  // interface types returned along the chain.
  overrideAnalyticsRule(
    fn: RuleTypes extends ['informational']
      ? never
      : RuleFn<AnalyzeContext, Options>,
  ): DefineRules<RuleTypes, Options, RuleType> {
    if (isInformationalRule(this.#rule)) {
      throw new Error('Cannot define rule function for this type of rule.');
    }

    this.#rule.analyzeRule = fn;

    return this as unknown as DefineRules<RuleTypes, Options, RuleType>;
  }

  overrideStaticRule(
    fn: RuleTypes extends ['informational']
      ? never
      : RuleFn<LintContext, Options>,
  ): DefineRules<RuleTypes, Options, RuleType> {
    if (isInformationalRule(this.#rule)) {
      throw new Error('Cannot define rule function for this type of rule.');
    }

    this.#rule.lintRule = fn;

    return this as unknown as DefineRules<RuleTypes, Options, RuleType>;
  }

  overrideTest(
    fn: RuleTypes extends ['informational']
      ? never
      : RuleFn<TestContext, Options>,
  ): DefineRules<RuleTypes, Options, RuleType> {
    if (isInformationalRule(this.#rule)) {
      throw new Error('Cannot define rule function for this type of rule.');
    }

    this.#rule.testRule = fn;

    return this as unknown as DefineRules<RuleTypes, Options, RuleType>;
  }

  done(): Rule<Options> {
    if (this.#rule.meta.description && !this.#rule.meta.summary) {
      this.#rule.meta.summary = this.#rule.meta.description;
    }

    if (!this.#rule.meta.description && this.#rule.meta.summary) {
      this.#rule.meta.description = this.#rule.meta.summary;
    }

    const violation = checkRuleExecutionInvariant(this.#rule);

    if (violation) {
      const { message } = describeRuleExecutionInvariantViolation(
        this.#rule.meta.name,
        violation,
      );

      throw new Error(message);
    }

    return this.#rule;
  }
}

// Compile-time conformance check (never called): an `implements` clause
// cannot express the conditional `done` property, so assert here that
// RuleBuilder still structurally satisfies the public builder interfaces.
// Interface states with a non-callable `done` deliberately narrow the class
// and can never be supertypes of it, so the provable states are asserted:
// full conformance for informational rules (which also covers all meta-
// property methods) and the coverage-complete DefineRules end state for
// executable rules. `severity` and `type` are covered by the `implements`
// clause on the class.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function assertRuleBuilderConformance(
  executable: RuleBuilder<
    Record<PropertyKey, unknown>,
    ['static', 'analytics', 'test']
  >,
  informational: RuleBuilder<Record<PropertyKey, unknown>, ['informational']>,
): [
  DefineRules<
    ['static', 'analytics', 'test'],
    Record<PropertyKey, unknown>,
    'static' | 'analytics' | 'test'
  >,
  DefineOptionalRuleMetaProperties<['informational']>,
] {
  return [executable, informational];
}

export function httpRule(name: string): DefineRuleSeverity {
  if (name.includes(' ')) {
    throw new Error('Rule name cannot contain spaces: ' + name);
  }
  return new RuleBuilder(name);
}
