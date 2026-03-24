import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';

import { glob } from 'tinyglobby';

import { ThymianBaseError } from '../thymian.error.js';
import { isRecord } from '../utils.js';
import type { Rule } from './rule.js';
import type { RuleSet } from './rule-set.js';

const require = createRequire(import.meta.url);

type RecordWithFunctions<Properties extends string[]> = Record<
  PropertyKey,
  unknown
> &
  Record<Properties[number], (...args: unknown[]) => unknown>;

function areFunctionPropertiesIfDefined<Properties extends string[]>(
  obj: Record<PropertyKey, unknown>,
  properties: Properties,
): obj is RecordWithFunctions<Properties> {
  return properties.some(
    (property) =>
      Object.hasOwn(obj, property) && typeof obj[property] !== 'function',
  );
}

export function isRule(rule: unknown): rule is Rule {
  if (!(isRecord(rule) && 'meta' in rule)) {
    return false;
  }

  return !areFunctionPropertiesIfDefined(rule, [
    'rule',
    'lintRule',
    'analyzeRule',
    'testRule',
    'staticRule',
    'analyticsRule',
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

async function loadRuleSet(
  ruleSet: RuleSet,
  basePath: string,
): Promise<Rule[]> {
  if (ruleSet.rules) {
    return ruleSet.rules;
  }

  const rules: Rule[] = [];

  if (ruleSet.pattern) {
    const dirname = path.dirname(basePath);

    for (const pattern of Array.isArray(ruleSet.pattern)
      ? ruleSet.pattern
      : [ruleSet.pattern]) {
      const files = await glob(pattern, { cwd: dirname });

      for (const file of files) {
        rules.push(...(await loadRules(path.join(dirname, file))));
      }
    }
  }

  return rules;
}

export async function loadRules(input: string | string[]): Promise<Rule[]> {
  if (!input || (Array.isArray(input) && input.length === 0)) {
    return [];
  }

  if (Array.isArray(input)) {
    return (await Promise.all(input.map((entry) => loadRules(entry)))).flat();
  }

  let location = input;
  const fileLocation = path.join(process.cwd(), input);

  if (existsSync(fileLocation)) {
    location = fileLocation;
  } else if (input.startsWith('@thymian/')) {
    const workspacePackageName = input.replace('@thymian/', '');
    const workspaceSourceEntry = path.join(
      process.cwd(),
      'packages',
      workspacePackageName,
      'src',
      'index.ts',
    );

    if (existsSync(workspaceSourceEntry)) {
      location = workspaceSourceEntry;
    }
  }

  let resolved: string;

  try {
    resolved = require.resolve(location);
  } catch {
    if (input.startsWith('@thymian/')) {
      const workspacePackageName = input.replace('@thymian/', '');
      const workspaceSourceEntry = path.join(
        process.cwd(),
        'packages',
        workspacePackageName,
        'src',
        'index.ts',
      );

      if (existsSync(workspaceSourceEntry)) {
        resolved = workspaceSourceEntry;
      } else {
        throw new ThymianBaseError(`Cannot resolve rule source ${input}.`, {
          name: 'RuleLoadError',
          ref: 'https://thymian.dev/references/errors/rule-load-error/',
        });
      }
    } else {
      throw new ThymianBaseError(`Cannot resolve rule source ${input}.`, {
        name: 'RuleLoadError',
        ref: 'https://thymian.dev/references/errors/rule-load-error/',
      });
    }
  }

  const module = await import(resolved);

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
    return [ruleOrRuleSet];
  }

  if (isRuleSet(ruleOrRuleSet)) {
    return loadRuleSet(ruleOrRuleSet, resolved);
  }

  return [];
}
