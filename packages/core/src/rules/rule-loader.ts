import * as path from 'node:path';

import { glob } from 'tinyglobby';

import { loadUserModule, resolveUserModule } from '../load-user-module.js';
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

/**
 * The extensions a globbed rule-set match may have, mirroring the allow-list inside
 * `resolveUserModule` — a match this does not admit is one the seam declines, so admitting it could
 * only ever produce an error. Kept case-sensitive for exactly that reason: the seam normalises a
 * resolved path to its on-disk casing and then tests the same case-sensitive pattern, so a
 * `Rule.TS` is not loadable there and must not be waved through here either.
 */
const LOADABLE_RULE_FILE = /\.[cm]?[jt]s$/;

/**
 * Declaration files are never loadable — they contain no runtime code. Case-insensitive to match
 * the seam, because on Windows and default macOS volumes a `Types.D.TS` resolves fine and a
 * case-sensitive guard would wave through the exact file it exists to stop.
 */
const DECLARATION_FILE = /\.d\.[cm]?ts$/i;

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
      //
      // Then drop what cannot be a module at all. A pattern is a plain glob, so `**/*.ts` picks up
      // a neighbouring `types.d.ts` and `**/*` also picks up a `rules.json` or a `README.md`; the
      // seam declines every one of them, so without this filter the whole rule set dies on
      // `Cannot resolve rule source` naming a file that plainly exists and that the user never
      // meant to load. A skipped match is not an error and produces no diagnostic.
      const files = (await glob(pattern, { cwd: dirname }))
        .sort()
        .filter(
          (file) =>
            LOADABLE_RULE_FILE.test(file) && !DECLARATION_FILE.test(file),
        );

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

  // Resolution and loading both go through the shared user-module seam, which is what makes a
  // TypeScript rule loadable: it dispatches on the RESOLVED extension, sending `.ts`/`.mts`/`.cts`
  // through jiti and everything else — the 182 built-in JavaScript rules included — through a plain
  // dynamic import that never pays for jiti. `resolveUserModule` never throws; it answers
  // `undefined`, which is what keeps this error message owned here.
  const resolved = await resolveUserModule(input, cwd);

  if (resolved === undefined) {
    throw new ThymianBaseError(`Cannot resolve rule source ${input}.`, {
      name: 'RuleLoadError',
      ref: 'https://thymian.dev/references/errors/rule-load-error/',
    });
  }

  const module = await loadUserModule(resolved);

  if (!('default' in module)) {
    throw new ThymianBaseError(
      // Names the RESOLVED path rather than the specifier: `…/simple.rule.ts` is the file to open,
      // where `./simple.rule` left the user to work it out — and for a name that is both installed
      // and present in `cwd`, a locally recomputed path would name a file that was never loaded.
      `Rule or rule set at ${resolved} does not use default export.`,
      {
        suggestions: [
          // Scoped rather than blanket: `module.exports =` in a `.ts`/`.cts` source produces a
          // namespace with no `default` key that jiti's interop cannot tell apart from a
          // named-only module, so the seam cannot honour it. Suggesting it to a TypeScript author
          // told them to do something that provably fails.
          'Use "export default" to export your rule (set), or "module.exports =" in a CommonJS JavaScript file.',
          'A TypeScript source must use "export default" — "module.exports =" there produces a namespace with no default export, indistinguishable from a module with only named exports.',
        ],
        name: 'RuleLoadError',
        ref: 'https://thymian.dev/references/errors/rule-load-error/',
      },
    );
  }

  const ruleOrRuleSet = module.default;

  if (isRule(ruleOrRuleSet)) {
    const rule = applyProfileThenConfig(ruleOrRuleSet, profileConfig, options);

    assertRuleTypeDeclaration(rule, resolved);

    if (!ruleFilter(rule)) {
      return [];
    }

    assertRuleExecutionInvariant(
      rule,
      resolved,
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
