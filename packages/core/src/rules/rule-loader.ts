import { lstatSync, realpathSync, statSync } from 'node:fs';
import * as path from 'node:path';

import { glob } from 'tinyglobby';

import {
  loadUserModule,
  resolveUserModule,
  unloadableReason,
} from '../load-user-module.js';
import type { Logger } from '../logger/logger.js';
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

// The single per-rule pipeline shared by every path that turns a candidate
// `Rule` into an eligible one: config/profile overrides, type-declaration
// validation, the caller's filter, then the execution-invariant check.
// `undefined` means the rule filter excluded it (not an error, just no-op).
function resolveEligibleRule(
  rawRule: Rule,
  source: string,
  profileConfig: RulesConfiguration,
  options: RulesConfiguration,
  ruleFilter: RuleFilter,
): Rule | undefined {
  const rule = applyProfileThenConfig(rawRule, profileConfig, options);

  assertRuleTypeDeclaration(rule, source);

  if (!ruleFilter(rule)) {
    return undefined;
  }

  assertRuleExecutionInvariant(
    rule,
    source,
    typeOverrideSuggestions(rule, options),
  );

  return rule;
}

function assertHasDefaultExport(
  module: Record<PropertyKey, unknown>,
  resolved: string,
): void {
  if (!('default' in module)) {
    throw new ThymianBaseError(
      `Rule or rule set at ${resolved} does not use default export.`,
      {
        suggestions: [
          'Use "export default" or "module.exports =" to export your rule (set).',
        ],
        name: 'RuleLoadError',
        ref: 'https://thymian.dev/references/errors/rule-load-error/',
      },
    );
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// The glob filter's own guard, on top of the seam's `unloadableReason`
// (extension/declaration-file predicate — reused, never hand-copied):
// classifies a match by filesystem kind so a directory/FIFO/socket/broken
// symlink is *skipped* rather than attempted. A path that is not on disk at
// all is deliberately left unclassified here (`undefined`) — that is not
// "the wrong kind", it is a match that vanished between the glob call and
// the load attempt below, which must fail the whole set, not be skipped.
function nonLoadableGlobMatchReason(
  resolved: string,
  canonical: string | undefined,
): string | undefined {
  const extensionReason = unloadableReason(resolved);

  if (extensionReason) {
    return extensionReason;
  }

  // A symlink can have a loadable *spelling* (e.g. `alias.rule.ts`) while its
  // realpath target is an unloadable kind (`real.d.ts`, `.mts`/`.cts`). We load
  // through the canonical path, and `loadUserModule` would throw on it — which
  // would fail the whole set. Classify it as a skip here instead, per AC3, so
  // it is warned-and-skipped like a directly-matched unloadable file.
  if (canonical !== undefined) {
    const canonicalExtensionReason = unloadableReason(canonical);

    if (canonicalExtensionReason) {
      return canonicalExtensionReason;
    }
  }

  let entryStat: ReturnType<typeof lstatSync>;

  try {
    entryStat = lstatSync(resolved);
  } catch {
    return undefined;
  }

  if (entryStat.isSymbolicLink()) {
    try {
      if (!statSync(resolved).isFile()) {
        return `"${path.basename(resolved)}" is a symlink to something other than a regular file.`;
      }
    } catch {
      return `"${path.basename(resolved)}" is a broken symlink.`;
    }

    return undefined;
  }

  if (!entryStat.isFile()) {
    return `"${path.basename(resolved)}" is not a regular file.`;
  }

  return undefined;
}

function warnSkippedGlobMatch(
  resolved: string,
  reason: string,
  ruleSetName: string,
  logger: Logger | undefined,
): void {
  // A skipped match is a non-fatal diagnostic (AC3): warn through the caller's
  // logger, not `process.emitWarning` — the latter surfaces as a raw Node
  // warning with a stack trace, which reads as an internal fault to users. The
  // message stays self-contained (reason + remedy + reference) so it carries
  // the same framing the thrown errors do.
  logger?.warn(
    `Skipping "${resolved}" matched by rule set "${ruleSetName}": ${reason} ` +
      'Remove or fix the file so it matches a loadable rule, or narrow the ' +
      'glob pattern to exclude it. See ' +
      'https://thymian.dev/references/errors/rule-load-error/',
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
  logger: Logger | undefined,
): Promise<Rule[]> {
  if (ruleSet.rules) {
    const source = `rule set "${ruleSet.name}"`;
    const rules: Rule[] = [];

    for (const inlineRule of ruleSet.rules) {
      const rule = resolveEligibleRule(
        inlineRule,
        source,
        profileConfig,
        options,
        ruleFilter,
      );

      if (rule) {
        rules.push(rule);
      }
    }

    return rules;
  }

  const rules: Rule[] = [];

  if (ruleSet.pattern) {
    const dirname = path.dirname(basePath);
    let anyMatched = false;
    // Tracks whether any matched module was itself a loadable `Rule`, *before*
    // the caller's `ruleFilter` runs. The "matched files but no rules" throw
    // keys off this rather than `rules.length`, so a set whose rules were all
    // excluded by the filter (e.g. `rules list` with a strict severity
    // threshold) returns empty instead of throwing — matching how the inline
    // `ruleSet.rules` branch behaves when everything is filtered out.
    let anyRuleLoaded = false;

    for (const pattern of Array.isArray(ruleSet.pattern)
      ? ruleSet.pattern
      : [ruleSet.pattern]) {
      // Sort glob results so rule load order is deterministic. tinyglobby
      // returns matches in filesystem traversal order, which varies between
      // runs and would otherwise make downstream report output non-deterministic.
      const files = (
        await glob(pattern, { cwd: dirname, ignore: ['**/node_modules/**'] })
      ).sort();

      for (const file of files) {
        const resolved = path.resolve(dirname, file);

        let canonical: string | undefined;

        try {
          canonical = realpathSync.native(resolved);
        } catch {
          canonical = undefined;
        }

        // The rule set's own file is excluded from its own matches (trivial
        // self-match), and never counted toward "anything matched".
        if (canonical !== undefined && canonical === basePath) {
          continue;
        }

        anyMatched = true;

        const skipReason = nonLoadableGlobMatchReason(resolved, canonical);

        if (skipReason) {
          warnSkippedGlobMatch(resolved, skipReason, ruleSet.name, logger);
          continue;
        }

        // `loadUserModule` keys its exactly-once cache on the canonical
        // (realpath) path, so load through `canonical` whenever we have it: a
        // symlinked spelling would otherwise execute the same rule file twice
        // and bypass the seam's canonicalization guarantee. When realpath
        // failed above (`canonical` is undefined) the match vanished between
        // the glob call and here — loading `resolved` then fails, which fails
        // the whole set, exactly the intended "vanished" behavior. User-facing
        // messages below stay on the non-canonical `resolved`.
        const loadPath = canonical ?? resolved;

        let rawModule: unknown;

        try {
          rawModule = await loadUserModule(loadPath);
        } catch (error) {
          throw new ThymianBaseError(
            `Rule set "${ruleSet.name}" failed to load "${resolved}": ${describeError(error)}`,
            {
              name: 'RuleLoadError',
              suggestions: [
                'Fix the syntax or runtime error in the file, or remove it from the glob pattern.',
              ],
              ref: 'https://thymian.dev/references/errors/rule-load-error/',
              cause: error,
            },
          );
        }

        const module = isRecord(rawModule) ? rawModule : {};

        assertHasDefaultExport(module, resolved);

        const candidate = module.default;

        if (isRuleSet(candidate)) {
          throw new ThymianBaseError(
            `"${resolved}" is a rule set; rule sets cannot contain rule sets.`,
            {
              name: 'RuleLoadError',
              suggestions: [
                `Rule set "${ruleSet.name}" matched "${resolved}" via its glob pattern, but a rule set can only reference individual rules, not other rule sets.`,
              ],
              ref: 'https://thymian.dev/references/errors/rule-load-error/',
            },
          );
        }

        if (isRule(candidate)) {
          anyRuleLoaded = true;

          const rule = resolveEligibleRule(
            candidate,
            resolved,
            profileConfig,
            options,
            ruleFilter,
          );

          if (rule) {
            rules.push(rule);
          }
        }
      }
    }

    if (anyMatched && !anyRuleLoaded) {
      throw new ThymianBaseError(
        `Rule set "${ruleSet.name}" pattern matched files but produced no loadable rules.`,
        {
          name: 'RuleLoadError',
          suggestions: [
            'Check that the glob pattern matches rule files whose default export is a rule.',
          ],
          ref: 'https://thymian.dev/references/errors/rule-load-error/',
        },
      );
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
  // The already-resolved profile overrides for the enclosing rule set. Empty
  // at the top level; a rule set fills it from its own `profiles` map before
  // dispatching to its member rules (inline or glob-matched).
  profileConfig: RulesConfiguration = {},
  // The caller's logger, used to surface non-fatal glob-match skips (AC3).
  // Optional so direct callers (e.g. tests, plugins) may omit it.
  logger?: Logger,
): Promise<Rule[]> {
  if (!input || (Array.isArray(input) && input.length === 0)) {
    return [];
  }

  if (Array.isArray(input)) {
    return (
      await Promise.all(
        input.map((entry) =>
          loadRules(
            entry,
            ruleFilter,
            options,
            cwd,
            ruleProfiles,
            profileConfig,
            logger,
          ),
        ),
      )
    ).flat();
  }

  const resolution = resolveUserModule(input, { cwd });

  if (!resolution.ok) {
    throw resolution.reason
      ? new ThymianBaseError(
          // The seam's reason is a complete sentence that already ends in a
          // period; strip a trailing one before adding ours so the message
          // never doubles up ("...JavaScript..").
          `Cannot load rule source ${input}: ${resolution.reason.replace(/\.$/, '')}.`,
          {
            suggestions: [
              'Reference a built .js/.mjs/.cjs file or a local .ts file with an explicit extension. Installed packages must ship built JavaScript.',
            ],
            name: 'RuleLoadError',
            ref: 'https://thymian.dev/references/errors/rule-load-error/',
          },
        )
      : new ThymianBaseError(`Cannot resolve rule source ${input}.`, {
          suggestions: [
            'For a local rule, use a relative path with an explicit extension (e.g. ./my.rule.ts). For an installed package, check that it is installed.',
          ],
          name: 'RuleLoadError',
          ref: 'https://thymian.dev/references/errors/rule-load-error/',
        });
  }

  const resolved = resolution.path;
  const rawModule = await loadUserModule(resolved);
  const module = isRecord(rawModule) ? rawModule : {};

  assertHasDefaultExport(module, resolved);

  const ruleOrRuleSet = module.default;

  if (isRule(ruleOrRuleSet)) {
    const rule = resolveEligibleRule(
      ruleOrRuleSet,
      resolved,
      profileConfig,
      options,
      ruleFilter,
    );

    return rule ? [rule] : [];
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
      logger,
    );
  }

  return [];
}
