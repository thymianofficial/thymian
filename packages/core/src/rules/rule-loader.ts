import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { glob } from 'tinyglobby';

import { ThymianBaseError } from '../thymian.error.js';
import { isRecord } from '../utils.js';
import { validate } from './ajv-validate.js';
import type { Rule } from './rule.js';
import type { RulesConfiguration } from './rule-configuration.js';
import {
  checkRuleExecutionInvariant,
  checkRuleTypeDeclaration,
  describeRuleExecutionInvariantViolation,
  type RuleExecutionInvariantViolation,
  ruleFnPropertyByType,
} from './rule-execution-invariant.js';
import type { RuleFilter } from './rule-filter.js';
import type { RuleSet } from './rule-set.js';
import { isRuleSeverityLevel } from './rule-severity.js';

const require = createRequire(import.meta.url);

type RecordWithFunctions<Property extends PropertyKey> = Record<
  PropertyKey,
  unknown
> &
  Record<Property, (...args: unknown[]) => unknown>;

const ruleFunctionProperties = Object.values(ruleFnPropertyByType);

type RuleFunctionProperty = (typeof ruleFunctionProperties)[number];

function areFunctionPropertiesIfDefined(
  obj: Record<PropertyKey, unknown>,
): obj is RecordWithFunctions<RuleFunctionProperty> {
  return ruleFunctionProperties.every((property) => {
    if (!Object.hasOwn(obj, property)) {
      return true;
    }

    const value = obj[property];

    return value === undefined || typeof value === 'function';
  });
}

export function isRule(rule: unknown): rule is Rule {
  if (!(isRecord(rule) && 'meta' in rule)) {
    return false;
  }

  return areFunctionPropertiesIfDefined(rule);
}

function throwInvalidRuleError(
  rule: Rule,
  violation: RuleExecutionInvariantViolation,
  source: string,
  extraSuggestions: string[],
): never {
  const { message, suggestions } = describeRuleExecutionInvariantViolation(
    rule.meta.name,
    violation,
  );

  throw new ThymianBaseError(`${message} (loaded from ${source})`, {
    suggestions: [...suggestions, ...extraSuggestions],
    name: 'InvalidRuleError',
    ref: 'https://thymian.dev/references/errors/invalid-rule-error/',
  });
}

// Rule filters dereference meta.type, so a malformed type declaration must
// be rejected before the rule filter runs — even a disabled rule cannot be
// filtered reliably when its declaration is garbage.
function assertRuleTypeDeclaration(rule: Rule, source: string): void {
  const violation = checkRuleTypeDeclaration(rule);

  if (violation) {
    throwInvalidRuleError(rule, violation, source, []);
  }
}

// Guards the rule execution invariant at load time, where it is airtight:
// it also covers rules that bypass the httpRule builder (hand-constructed
// rule objects) and rules whose `type` was reassigned via configuration.
// Callers run this only on rules that passed the rule filter, so a broken
// rule in a third-party package can always be unblocked by disabling it.
// The 'informational-rule-with-execution-function' violation is deliberately
// tolerated here: configuration may downgrade an executable rule to
// 'informational' to stop executing it, which leaves its (now unused)
// execution functions in place.
function assertRuleExecutionInvariant(
  rule: Rule,
  source: string,
  extraSuggestions: string[] = [],
): void {
  const violation = checkRuleExecutionInvariant(rule);

  if (
    !violation ||
    violation.reason === 'informational-rule-with-execution-function'
  ) {
    return;
  }

  throwInvalidRuleError(rule, violation, source, extraSuggestions);
}

function typeOverrideSuggestions(
  rule: Rule,
  options: RulesConfiguration,
): string[] {
  const ruleOptions = options[rule.meta.name];

  return isRecord(ruleOptions) && ruleOptions.type
    ? [
        `Check the "type" override for rule "${rule.meta.name}" in your Thymian config file.`,
      ]
    : [];
}

// Applies per-rule configuration overrides onto a copy of the rule, so the
// cached module object is never mutated.
function applyRuleConfiguration(rule: Rule, options: RulesConfiguration): Rule {
  const configured = {
    ...rule,
    meta: {
      ...rule.meta,
    },
  };

  const ruleOptions = options[configured.meta.name];

  if (isRecord(ruleOptions)) {
    configured.meta.severity = ruleOptions.severity ?? configured.meta.severity;
    configured.meta.type = ruleOptions.type ?? configured.meta.type;

    if (ruleOptions.options && configured.meta.options) {
      if (!validate(configured.meta.options, ruleOptions.options)) {
        throw new ThymianBaseError(
          `Options for rule "${configured.meta.name}" does not match the schema of the rule.`,
          {
            suggestions: [
              'Check the options for the rule in your Thymian config file.',
            ],
            name: 'InvalidRuleOptionError',
            ref: 'https://thymian.dev/references/errors/invalid-rule-option/',
          },
        );
      }
    }
  } else if (isRuleSeverityLevel(ruleOptions)) {
    configured.meta.severity = ruleOptions;
  }

  return configured;
}

export function isRuleSet(ruleSet: unknown): ruleSet is RuleSet {
  if (!(isRecord(ruleSet) && typeof ruleSet.name === 'string')) {
    return false;
  }

  return !(
    'rules' in ruleSet &&
    Array.isArray(ruleSet.rules) &&
    !ruleSet.rules.every(isRule)
  );
}

// The profile name selected for a rule set when its `profiles` map is missing
// the requested key, or when no explicit selection was threaded through. A
// bare/absent config entry resolves to `recommended` upstream; this default
// keeps a direct `loadRules(...)` call (e.g. a plugin) on the same profile.
const DEFAULT_RULE_PROFILE = 'recommended';

// Resolves the override map a rule set applies for the selected profile.
// Missing `profiles` or an unknown profile name yields an empty map (no-op),
// so an unlisted rule id or profile name is silently ignored (no throw).
function resolveProfileConfig(
  ruleSet: RuleSet,
  profileName: string,
): RulesConfiguration {
  return ruleSet.profiles?.[profileName] ?? {};
}

// Applies the selected profile's overrides before the user `rules:{}` config,
// so resolution order per rule is: shipped default -> profile -> user config
// (user always wins). Both passes reuse `applyRuleConfiguration`, so a profile
// value validates and merges through exactly the same path as a `rules:` entry.
function applyProfileThenConfig(
  rule: Rule,
  profileConfig: RulesConfiguration,
  options: RulesConfiguration,
): Rule {
  return applyRuleConfiguration(
    applyRuleConfiguration(rule, profileConfig),
    options,
  );
}

async function loadRuleSet(
  ruleSet: RuleSet,
  basePath: string,
  ruleFilter: RuleFilter,
  options: RulesConfiguration,
  cwd: string,
  ruleProfiles: Record<string, string>,
  profileConfig: RulesConfiguration,
): Promise<Rule[]> {
  if (ruleSet.rules) {
    const source = `rule set "${ruleSet.name}"`;
    const rules: Rule[] = [];

    for (const inlineRule of ruleSet.rules) {
      const rule = applyProfileThenConfig(inlineRule, profileConfig, options);

      assertRuleTypeDeclaration(rule, source);

      if (!ruleFilter(rule)) {
        continue;
      }

      assertRuleExecutionInvariant(
        rule,
        source,
        typeOverrideSuggestions(rule, options),
      );

      rules.push(rule);
    }

    return rules;
  }

  const rules: Rule[] = [];

  if (ruleSet.pattern) {
    const dirname = path.dirname(basePath);

    for (const pattern of Array.isArray(ruleSet.pattern)
      ? ruleSet.pattern
      : [ruleSet.pattern]) {
      // Sort glob results so rule load order is deterministic. tinyglobby
      // returns matches in filesystem traversal order, which varies between
      // runs and would otherwise make downstream report output non-deterministic.
      const files = (await glob(pattern, { cwd: dirname })).sort();

      for (const file of files) {
        rules.push(
          ...(await loadRules(
            path.join(dirname, file),
            ruleFilter,
            options,
            cwd,
            ruleProfiles,
            profileConfig,
          )),
        );
      }
    }
  }

  return rules;
}

export async function loadRules(
  input: string | string[],
  ruleFilter: RuleFilter = () => true,
  options: RulesConfiguration = {},
  cwd: string = process.cwd(),
  ruleProfiles: Record<string, string> = {},
  // The already-resolved profile overrides for the enclosing rule set, threaded
  // through the pattern-glob recursion. Empty at the top level; a rule set fills
  // it from its own `profiles` map before recursing into its member rules.
  profileConfig: RulesConfiguration = {},
): Promise<Rule[]> {
  if (!input || (Array.isArray(input) && input.length === 0)) {
    return [];
  }

  if (Array.isArray(input)) {
    return (
      await Promise.all(
        input.map((entry) =>
          loadRules(entry, ruleFilter, options, cwd, ruleProfiles),
        ),
      )
    ).flat();
  }

  let location = input;
  const fileLocation = path.resolve(cwd, input);

  if (existsSync(fileLocation)) {
    location = fileLocation;
  }

  let resolved: string;

  try {
    resolved = require.resolve(location);
  } catch {
    throw new ThymianBaseError(`Cannot resolve rule source ${input}.`, {
      name: 'RuleLoadError',
      ref: 'https://thymian.dev/references/errors/rule-load-error/',
    });
  }

  const module = await import(pathToFileURL(resolved).href);

  if (!('default' in module)) {
    throw new ThymianBaseError(
      `Rule or rule set at ${location} does not use default export.`,
      {
        suggestions: [
          'Use "export default" or "module.exports =" to export your rule (set).',
        ],
        name: 'RuleLoadError',
        ref: 'https://thymian.dev/references/errors/rule-load-error/',
      },
    );
  }

  const ruleOrRuleSet = module.default;

  if (isRule(ruleOrRuleSet)) {
    const rule = applyProfileThenConfig(ruleOrRuleSet, profileConfig, options);

    assertRuleTypeDeclaration(rule, location);

    if (!ruleFilter(rule)) {
      return [];
    }

    assertRuleExecutionInvariant(
      rule,
      location,
      typeOverrideSuggestions(rule, options),
    );

    return [rule];
  }

  if (isRuleSet(ruleOrRuleSet)) {
    const profileName = ruleProfiles[input] ?? DEFAULT_RULE_PROFILE;

    return loadRuleSet(
      ruleOrRuleSet,
      resolved,
      ruleFilter,
      options,
      cwd,
      ruleProfiles,
      resolveProfileConfig(ruleOrRuleSet, profileName),
    );
  }

  return [];
}
