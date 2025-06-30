import { createRequire } from 'node:module';
import * as path from 'node:path';

import { isRecord } from '@thymian/core';
import { glob } from 'tinyglobby';

import type { Rule } from './rule/rule.js';
import type { RuleSet } from './rule/rule-set.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

export type RuleFilter = (rule: Rule) => boolean;

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
  filterFn: RuleFilter
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
        rules.push(...(await loadRules(path.join(dirname, file), filterFn)));
      }
    }
  }

  return rules;
}

export async function loadRules(
  path: string | string[],
  filterFn: RuleFilter = () => true
): Promise<Rule[]> {
  if (Array.isArray(path)) {
    return (await Promise.all(path.map((p) => loadRules(p)))).flat();
  }

  let location = path;
  const fileLocation = join(process.cwd(), path);

  if (existsSync(fileLocation)) {
    location = fileLocation;
  }

  const resolved = require.resolve(location);

  const module = await import(resolved);

  if (!('default' in module)) {
    throw new Error('Rule and rule sets must use default export.');
  }

  const ruleOrRuleSet = module.default;

  if (isRule(ruleOrRuleSet) && filterFn(ruleOrRuleSet)) {
    return [ruleOrRuleSet];
  }

  if (isRuleSet(ruleOrRuleSet)) {
    return loadRuleSet(ruleOrRuleSet, resolved, filterFn);
  }

  return [];
}
