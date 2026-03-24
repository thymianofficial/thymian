import type { JSONSchemaType } from 'ajv';

import type {
  AnalyzeContext,
  ApiContext,
  LintContext,
  LiveApiContext,
  TestContext,
} from './contexts.js';
import type { Rule } from './rule.js';
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

interface DefineRuleType {
  type<Types extends [RuleType, ...RuleType[]]>(
    ...types: Types
  ): DefineOptionalRuleMetaProperties<Types>;
}

interface Done<Options extends Record<PropertyKey, unknown>> {
  done(): Rule<Options>;
}

interface DefineRules<
  RuleTypes extends [RuleType, ...RuleType[]],
  Options extends Record<PropertyKey, unknown>,
> extends Done<Options> {
  rule(
    fn: RuleTypes extends ['informational']
      ? never
      : RuleFn<ApiContextType<RuleTypes>, Options>,
  ): DefineRules<RuleTypes, Options>;

  overrideAnalyticsRule(
    ffn: RuleTypes extends ['informational']
      ? never
      : RuleFn<AnalyzeContext, Options>,
  ): DefineRules<RuleTypes, Options>;

  overrideStaticRule(
    fn: RuleTypes extends ['informational']
      ? never
      : RuleFn<LintContext, Options>,
  ): DefineRules<RuleTypes, Options>;

  overrideTest(
    fn: RuleTypes extends ['informational']
      ? never
      : RuleFn<TestContext, Options>,
  ): DefineRules<RuleTypes, Options>;
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
  implements
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
        name: name.trim(),
        type: ['static', 'analytics', 'test'],
        options: {} as JSONSchemaType<Options>,
      },
    };
  }

  type<Types extends [RuleType, ...RuleType[]]>(
    ...types: Types
  ): DefineOptionalRuleMetaProperties<Types> {
    this.#rule.meta.type = types;

    return this as unknown as DefineOptionalRuleMetaProperties<Types>;
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
    this.#rule.meta.description = url.trim();
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
  ): DefineRules<RuleTypes, Options> {
    if (isInformationalRule(this.#rule)) {
      throw new Error('Cannot define rule function for this type of rule.');
    }

    for (const t of this.#rule.meta.type) {
      if (t === 'static') {
        this.#rule.lintRule = fn;
      } else if (t === 'test') {
        this.#rule.testRule = fn;
      } else if (t === 'analytics') {
        this.#rule.analyzeRule = fn;
      }
    }

    return this;
  }

  overrideAnalyticsRule(
    fn: RuleTypes extends ['informational']
      ? never
      : RuleFn<AnalyzeContext, Options>,
  ): DefineRules<RuleTypes, Options> {
    if (isInformationalRule(this.#rule)) {
      throw new Error('Cannot define rule function for this type of rule.');
    }

    this.#rule.analyzeRule = fn;

    return this;
  }

  overrideStaticRule(
    fn: RuleTypes extends ['informational']
      ? never
      : RuleFn<LintContext, Options>,
  ): DefineRules<RuleTypes, Options> {
    if (isInformationalRule(this.#rule)) {
      throw new Error('Cannot define rule function for this type of rule.');
    }

    this.#rule.lintRule = fn;

    return this;
  }

  overrideTest(
    fn: RuleTypes extends ['informational']
      ? never
      : RuleFn<TestContext, Options>,
  ): DefineRules<RuleTypes, Options> {
    if (isInformationalRule(this.#rule)) {
      throw new Error('Cannot define rule function for this type of rule.');
    }

    this.#rule.testRule = fn;

    return this;
  }

  done(): Rule<Options> {
    if (this.#rule.meta.description && !this.#rule.meta.summary) {
      this.#rule.meta.summary = this.#rule.meta.description;
    }

    if (!this.#rule.meta.description && this.#rule.meta.summary) {
      this.#rule.meta.description = this.#rule.meta.summary;
    }

    return this.#rule;
  }
}

export function httpRule(name: string): DefineRuleSeverity {
  if (name.includes(' ')) {
    throw new Error('Rule name cannot contain spaces: ' + name);
  }
  return new RuleBuilder(name);
}
