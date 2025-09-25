import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { join } from 'node:path';

import { isRecord, ThymianBaseError } from '@thymian/core';
import { validate } from '@thymian/core/ajv';
import { glob } from 'tinyglobby';

import type { Rule } from './rule/rule.js';
import type { RuleSet } from './rule/rule-set.js';
import type { RuleFilter } from './rule-filter.js';

const require = createRequire(import.meta.url);

export function areFunctionPropertiesIfDefined<Properties extends string[]>(
  obj: Record<PropertyKey, unknown>,
  properties: Properties
): obj is Record<PropertyKey, unknown> &
  Record<Properties[number], (...args: unknown[]) => unknown> {
  return properties.some(
    (property) =>
      Object.hasOwn(obj, property) && typeof obj[property] !== 'function'
  );
}

// stricter checking?
export function isRule(rule: unknown): rule is Rule {
  if (!(isRecord(rule) && 'meta' in rule)) {
    return false;
  }

  return !areFunctionPropertiesIfDefined(rule, [
    'rule',
    'staticRule',
    'analyticsRule',
    'testRule',
  ]);
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

export async function loadRuleSet(
  ruleSet: RuleSet,
  basePath: string,
  filterFn: RuleFilter,
  options: Record<string, unknown>
): Promise<Rule[]> {
  if (ruleSet.rules) {
    return ruleSet.rules.filter(filterFn);
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
          ...(await loadRules(path.join(dirname, file), filterFn, options))
        );
      }
    }
  }

  return rules;
}

export async function loadRules(
  path: string | string[],
  ruleFilter: RuleFilter = () => true,
  options: Record<string, unknown> = {}
): Promise<Rule[]> {
  if (Array.isArray(path)) {
    return (
      await Promise.all(path.map((p) => loadRules(p, ruleFilter, options)))
    ).flat();
  }

  let location = path;
  const fileLocation = join(process.cwd(), path);

  if (existsSync(fileLocation)) {
    location = fileLocation;
  }

  const resolved = require.resolve(location);

  const module = await import(resolved);

  if (!('default' in module)) {
    throw new ThymianBaseError(
      `Rule or rule set at ${location} does not use default export.`,
      {
        suggestions: [
          'Use "export default" or "module.exports =" to export your rule (set).',
        ],
        name: 'RuleLoadError',
      }
    );
  }

  const ruleOrRuleSet = module.default;

  if (isRule(ruleOrRuleSet) && ruleFilter(ruleOrRuleSet)) {
    const ruleOptions = options[ruleOrRuleSet.meta.name];

    if (typeof ruleOptions === 'boolean') {
      if (!ruleOptions) {
        return [];
      }
    } else if (ruleOptions) {
      if (
        !validate(ruleOrRuleSet.meta.options, options[ruleOrRuleSet.meta.name])
      ) {
        throw new ThymianBaseError(
          `Options for rule "${ruleOrRuleSet.meta.name}" does not match the schema of the rule.`,
          {
            suggestions: [
              'Check the options for the rule in your Thymian config file.',
            ],
            name: 'InvalidRuleOptionError',
          }
        );
      }
    }

    return [ruleOrRuleSet];
  }

  if (isRuleSet(ruleOrRuleSet)) {
    return loadRuleSet(ruleOrRuleSet, resolved, ruleFilter, options);
  }

  return [];
}
