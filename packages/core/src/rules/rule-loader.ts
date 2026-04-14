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
import type { RuleFilter } from './rule-filter.js';
import type { RuleSet } from './rule-set.js';
import { isRuleSeverityLevel } from './rule-severity.js';

const require = createRequire(import.meta.url);

type RecordWithFunctions<Properties extends string[]> = Record<
  PropertyKey,
  unknown
> &
  Record<Properties[number], (...args: unknown[]) => unknown>;

const ruleFunctionProperties = ['lintRule', 'testRule', 'analyzeRule'] as const;

type RuleFunctionProperties = typeof ruleFunctionProperties;

function areFunctionPropertiesIfDefined(
  obj: Record<PropertyKey, unknown>,
): obj is RecordWithFunctions<[...RuleFunctionProperties]> {
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

async function loadRuleSet(
  ruleSet: RuleSet,
  basePath: string,
  ruleFilter: RuleFilter,
  options: RulesConfiguration,
  cwd: string,
): Promise<Rule[]> {
  if (ruleSet.rules) {
    return ruleSet.rules.filter(ruleFilter);
  }

  const rules: Rule[] = [];

  if (ruleSet.pattern) {
    const dirname = path.dirname(basePath);

    for (const pattern of Array.isArray(ruleSet.pattern)
      ? ruleSet.pattern
      : [ruleSet.pattern]) {
      const files = await glob(pattern, { cwd: dirname });

      for (const file of files) {
        rules.push(
          ...(await loadRules(
            path.join(dirname, file),
            ruleFilter,
            options,
            cwd,
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
): Promise<Rule[]> {
  if (!input || (Array.isArray(input) && input.length === 0)) {
    return [];
  }

  if (Array.isArray(input)) {
    return (
      await Promise.all(
        input.map((entry) => loadRules(entry, ruleFilter, options, cwd)),
      )
    ).flat();
  }

  let location = input;
  const fileLocation = path.join(cwd, input);

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
    // Create a shallow copy of the rule to avoid mutating the cached module
    const rule = {
      ...ruleOrRuleSet,
      meta: {
        ...ruleOrRuleSet.meta,
      },
    };

    const { name } = rule.meta;
    const ruleOptions = options[name];

    if (isRecord(ruleOptions)) {
      rule.meta.severity = ruleOptions.severity ?? rule.meta.severity;
      rule.meta.type = ruleOptions.type ?? rule.meta.type;

      if (ruleOptions.options && rule.meta.options) {
        if (!validate(rule.meta.options, ruleOptions.options)) {
          throw new ThymianBaseError(
            `Options for rule "${rule.meta.name}" does not match the schema of the rule.`,
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
      rule.meta.severity = ruleOptions;
    }

    if (ruleFilter(rule)) {
      return [rule];
    }

    return [];
  }

  if (isRuleSet(ruleOrRuleSet)) {
    return loadRuleSet(ruleOrRuleSet, resolved, ruleFilter, options, cwd);
  }

  return [];
}
