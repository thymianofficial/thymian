import type { AnalyticsApiContext } from './api-context/analytics-api-context.js';
import type { ApiContext, LiveApiContext } from './api-context/api-context.js';
import type { StaticApiContext } from './api-context/static-api-context.js';
import type { TestApiContext } from './api-context/test-api-context.js';
import type { Rule } from './rule/rule.js';
import type { RuleFn } from './rule/rule-fn.js';
import type { HttpParticipantRole, RuleType } from './rule/rule-meta.js';
import {
  isRuleSeverityLevel,
  type RuleSeverity,
} from './rule/rule-severity.js';

type ContextType<RuleTypes extends RuleType[]> =
  RuleTypes[number] extends 'static'
    ? StaticApiContext
    : RuleTypes[number] extends 'analytics'
    ? AnalyticsApiContext
    : RuleTypes[number] extends 'test'
    ? TestApiContext
    : RuleTypes[number] extends 'analytics' | 'test'
    ? LiveApiContext
    : ApiContext;

interface DefineRuleSeverity {
  severity(severity: RuleSeverity): DefineRuleType;
}

interface DefineRuleType {
  type<Types extends [RuleType, ...RuleType[]]>(
    ...types: Types
  ): DefineOptionalRuleMetaProperties<Types>;
}

interface Done<Options extends Record<PropertyKey, unknown>> {
  done(): Rule<Options>;
}

interface DefineRules<
  RuleTypes extends RuleType[],
  Options extends Record<PropertyKey, unknown>
> extends Done<Options> {
  rule(
    fn: RuleFn<ContextType<RuleTypes>, Options>
  ): DefineRules<RuleTypes, Options>;
}

interface DefineOptionalRuleMetaProperties<
  RuleTypes extends RuleType[],
  Options extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>
> extends DefineRules<RuleTypes, Options> {
  appliesTo(
    ...participants: [HttpParticipantRole, ...HttpParticipantRole[]]
  ): this;

  description(
    description: string
  ): DefineOptionalRuleMetaProperties<RuleTypes, Options>;

  url(url: string): this;

  tags(...tags: string[]): DefineOptionalRuleMetaProperties<RuleTypes, Options>;

  explanation(
    explanation: string
  ): DefineOptionalRuleMetaProperties<RuleTypes, Options>;

  options<Schema extends Record<PropertyKey, unknown>>(
    schema: Schema
  ): DefineOptionalRuleMetaProperties<RuleTypes, Schema>;
}

class RuleBuilder<
  Options extends Record<PropertyKey, unknown>,
  RuleTypes extends RuleType[]
> implements
    DefineOptionalRuleMetaProperties<RuleTypes, Options>,
    DefineRuleType,
    DefineRuleSeverity
{
  readonly #rule: Rule<Options>;

  constructor(name: string) {
    this.#rule = {
      meta: {
        severity: 'off',
        tags: [],
        name,
        type: ['static', 'analytics', 'test'],
        options: {},
      },
    };
  }

  type<Types extends [RuleType, ...RuleType[]]>(
    ...types: Types
  ): DefineOptionalRuleMetaProperties<Types> {
    this.#rule.meta.type = types;

    return this as DefineOptionalRuleMetaProperties<Types>;
  }

  appliesTo(
    ...participants: [HttpParticipantRole, ...HttpParticipantRole[]]
  ): this {
    this.#rule.meta.appliesTo = participants;
    return this;
  }

  description(description: string): this {
    this.#rule.meta.description = description;
    return this;
  }

  url(url: string): this {
    this.#rule.meta.description = url;
    return this;
  }

  tags(...tags: string[]): this {
    this.#rule.meta.tags = tags;
    return this;
  }

  explanation(explanation: string): this {
    this.#rule.meta.explanation = explanation;
    return this;
  }

  options<Schema extends Record<PropertyKey, unknown>>(
    schema: Schema
  ): DefineOptionalRuleMetaProperties<RuleTypes, Schema> {
    this.#rule.meta.options = schema;

    return this as unknown as DefineOptionalRuleMetaProperties<
      RuleTypes,
      Schema
    >;
  }

  severity(severity: RuleSeverity): DefineRuleType {
    if (!isRuleSeverityLevel(severity)) {
      throw new Error('Invalid rule severity.');
    }
    this.#rule.meta.severity = severity;

    return this as DefineRuleType;
  }

  rule(
    fn: RuleFn<ContextType<RuleTypes>, Options>
  ): DefineRules<RuleTypes, Options> {
    this.#rule.rule = fn;

    return this;
  }

  done(): Rule<Options> {
    return this.#rule;
  }
}

export function httpRule(name: string): DefineRuleSeverity {
  return new RuleBuilder(name);
}
