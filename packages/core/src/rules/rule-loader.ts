import { realpathSync } from 'node:fs';
import * as path from 'node:path';

import { glob } from 'tinyglobby';

import {
  loadUserModule,
  miscasedExtension,
  resolveUserModule,
  unloadableReason,
} from '../load-user-module.js';
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

/**
 * What to name as the source of a rule in a diagnostic.
 *
 * The resolved path is the file to open, which is why it replaced the specifier here — but for a
 * BARE specifier it is a deep install path the user never typed: `@thymian/rules-rfc-9110` resolves
 * to `…/packages/rules-rfc-9110/dist/index.js`, and naming only that loses the identity they wrote
 * in their config. Naming both keeps the actionable path without the loss. They collapse to one
 * when the specifier already IS the resolved path, which is every absolute-path and globbed case.
 */
function describeRuleSource(input: string, resolved: string): string {
  return input === resolved ? resolved : `${input} (${resolved})`;
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
 * A rule set that is reachable from itself through pattern globs can never finish loading, so it is
 * reported rather than pursued.
 *
 * The seam's own cycle detection cannot see this one. `loadUserModule` tracks an evaluation chain in
 * `AsyncLocalStorage`, but that store only covers the import itself — by the time this file resumes
 * after the `await` the store is gone, and the second import of the same rule set is a plain
 * module-cache hit that is never "in flight". The cycle lives in THIS file's traversal, not in module
 * evaluation, so it has to be tracked here.
 *
 * Shaped after `load-user-module.ts`'s `cycleError`: one sentence, the closed loop rendered as given.
 * `ring` is printed verbatim, so callers pass a loop that already returns to its first entry.
 */
function ruleSetCycleError(
  canonical: string,
  ring: readonly string[],
): ThymianBaseError {
  return new ThymianBaseError(
    `Rule set at ${canonical} is reachable from itself, so the rule-set cycle ` +
      `${ring.join(' -> ')} can never finish loading.`,
    {
      suggestions: [
        'Narrow the `pattern` of one rule set in the cycle so it stops matching the other.',
        'Point each rule set at a directory of rules rather than at a directory holding rule sets.',
        // Every entry in `ring` is a canonical, symlink-resolved path, so two different-looking
        // paths can still be the SAME rule set. Named explicitly: the two "pattern" suggestions
        // above assume the loop is a pattern-authoring mistake, which is not true when a symlink
        // is what closes it.
        'If two entries above resolve through a symlink, remove the symlink or point it elsewhere.',
      ],
      name: 'RuleLoadError',
      ref: 'https://thymian.dev/references/errors/rule-load-error/',
    },
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
  // Canonical paths of the rule sets currently being loaded, innermost last, INCLUDING this one.
  // A stack rather than a cumulative visited set: see `loadRulesInChain`.
  ruleSetChain: readonly string[],
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
      // `node_modules` is excluded because a wide pattern reaching into it would IMPORT and execute
      // every dependency module it matched. Before the loadable-file filter below that failed loudly
      // on the first non-module; with it, the JavaScript files sail through and run.
      //
      // The rule set's OWN file is dropped before anything else looks at the list. A pattern as
      // ordinary as `./**/*` matches the file it is written in, and loading that re-recognises the
      // same rule set and re-runs the same glob forever — no output, no error, no exit, which for a
      // linter means a CI job that hangs until the runner times out. Skipping is silent because the
      // pattern is legitimate: the user meant "the rules beside me", and a rule set is not one of
      // its own rules.
      //
      // Removed HERE, before `matched` is formed, so it never reaches the "matched files but kept
      // none" check below. Filtered afterwards, a rule set alone in its directory would die on
      // `none of which can be loaded as a rule` — naming a file that loads perfectly well and that
      // the user cannot act on. A pattern that matched only the rule set itself simply yields no
      // rules; one that also swept up a `README.md` still fails on the `README.md`.
      //
      // Raw string equality is only trustworthy because `basePath` is always the seam's
      // `realpathSync.native`-canonicalised path (see the two call sites below that pass
      // `resolved.path`); `dirname` inherits that same canonicalisation. A future call site that
      // passed a non-canonical `basePath` would silently break this skip and reopen the #688 hang.
      const matched = (
        await glob(pattern, { cwd: dirname, ignore: ['**/node_modules/**'] })
      )
        .filter((file) => path.join(dirname, file) !== basePath)
        .sort();

      // Drop what cannot be a module at all. A pattern is a plain glob, so `**/*.ts` picks up a
      // neighbouring `types.d.ts` and `**/*` also picks up a `rules.json` or a `README.md`; the seam
      // declines every one of them, so without this the whole rule set dies on `Cannot resolve rule
      // source` naming a file that plainly exists and that the user never meant to load.
      //
      // The loadability test itself runs on the match's REALPATH, not the raw glob spelling — the
      // same predicate the seam applies, given the same kind of input the seam gives it (a resolved
      // path, not a filename) — so a symlink agrees with the seam in both directions instead of
      // testing one shape here and importing a different one below. A match whose realpath cannot
      // be resolved (a broken symlink, ENOENT) is treated as not loadable, the same as any other
      // declined file.
      //
      // One decline is NOT silent, though. A module refused only for how its extension is cased is
      // not in the "cannot be a module at all" class this filter exists to drop — nothing this seam
      // uses can load it, yet it is shaped like code (#690). What makes it worth failing on is not
      // that assumption on its own, which is unreliable — `.TS` is also MPEG transport stream and
      // `.MTS` is AVCHD — but the combination below: it disappeared behind siblings that DID load,
      // so the rule set looks healthy while silently running without it.
      //
      // Hence the gate. When NOTHING loaded, the all-declined guard further down is the better
      // diagnosis and keeps its place; an unconditional throw here would also kill the run over a
      // file the user cannot rename, since `ignore` matches the GLOB path while tinyglobby follows
      // symlinked directories into dependencies and build output. Reported offender is the first in
      // `matched`, which is sorted, so the message is deterministic.
      const files: string[] = [];
      const miscased: { file: string; resolved: string; extension: string }[] =
        [];

      for (const file of matched) {
        const joined = path.join(dirname, file);
        let resolved: string;

        try {
          resolved = realpathSync.native(joined);
        } catch {
          continue;
        }

        const extension = miscasedExtension(resolved);

        if (extension !== undefined) {
          miscased.push({ file, resolved, extension });

          continue;
        }

        if (unloadableReason(resolved) === undefined) {
          files.push(file);
        }
      }

      const offender = miscased[0];

      if (offender !== undefined && files.length > 0) {
        // Sourced from `unloadableReason`, never hand-written: this file already relies on that
        // being the ONE place a refusal is explained, and a second copy of the sentence would drift
        // from the seam's with nothing to catch it.
        const reason = unloadableReason(offender.resolved);
        // Names the realpath too when it differs, so a symlinked match cannot quote a `.JS` while
        // naming a `.ts` file — which would make the rename suggestion a no-op.
        const named =
          offender.resolved === path.join(dirname, offender.file)
            ? offender.file
            : `${offender.file} (${offender.resolved})`;

        throw new ThymianBaseError(
          `Rule set "${ruleSet.name}" pattern ${pattern} matched ${named}: ${reason}.`,
          {
            // Exclusion leads deliberately. The file may be a media asset that must NOT be renamed
            // — renaming `00000.MTS` makes it a loadable match that then dies on a binary parse —
            // or it may live inside a dependency the user has no right to touch.
            suggestions: [
              `Exclude it from ${pattern}, or narrow the pattern, if the file is not a rule — an upper-case ".TS" or ".MTS" is also a media extension, and a match reached through a symlinked directory may not be yours to rename.`,
              `If it is a rule, rename it so its extension is lower-case ("${offender.extension.toLowerCase()}").`,
            ],
            name: 'RuleLoadError',
            ref: 'https://thymian.dev/references/errors/rule-load-error/',
          },
        );
      }

      // An individual skip is silent — that is the point of the filter. But a pattern that matched
      // files and kept NONE of them is a mistake every time: a typo'd extension, a pattern aimed at
      // a directory of declarations, `*.tsx`. Left silent it returns zero rules, and `lint` only
      // whispers `Loaded 0 rule(s)` at info level while `test` and `analyze` say nothing at all —
      // so the run passes having validated nothing. Fail instead.
      //
      // Deliberately counts FILES, not the rules they yield: a rule filter legitimately excludes
      // every rule it loaded, and that must stay a clean empty result.
      if (matched.length > 0 && files.length === 0) {
        throw new ThymianBaseError(
          `Rule set "${ruleSet.name}" pattern ${pattern} matched ${matched.length} file(s), none of which can be loaded as a rule.`,
          {
            suggestions: [
              'Point the pattern at rule modules (.js, .mjs, .cjs, .ts, .mts, .cts) rather than declarations or data files.',
              'Check the pattern for a typo in the extension or directory name.',
            ],
            name: 'RuleLoadError',
            ref: 'https://thymian.dev/references/errors/rule-load-error/',
          },
        );
      }

      for (const file of files) {
        rules.push(
          ...(await loadRulesInChain(
            path.join(dirname, file),
            ruleFilter,
            options,
            cwd,
            ruleProfiles,
            profileConfig,
            ruleSetChain,
          )),
        );
      }
    }
  }

  return rules;
}

/**
 * Loads rules, carrying the chain of rule sets currently being loaded.
 *
 * The chain is a STACK, not a cumulative visited set: it is pushed on entry to a rule set and
 * implicitly popped on return, so it describes the current ancestry and nothing else. A set that
 * accumulated across sibling branches would refuse the SECOND, legitimate load of a rule set that
 * two different parents both point at — a diamond is not a cycle. Loading such a shared rule set
 * once per path is the behaviour that already existed and is deliberately preserved.
 *
 * Termination rests on this chain, not on the self-match skip in `loadRuleSet`: every step of the
 * recursion resolves through the seam to a canonical path, so any repeat is caught here. The skip is
 * the fast path that keeps an ordinary `./**\/*` silent; anything it misses — a symlink beside the
 * rule set pointing back at it — falls through to a clear error rather than a hang.
 *
 * Not exported. `loadRules` is public API with callers across the workspace, so the chain is kept
 * out of its signature entirely rather than added as a seventh parameter nobody outside this file
 * should pass.
 */
async function loadRulesInChain(
  input: string | string[],
  ruleFilter: RuleFilter,
  options: RulesConfiguration,
  cwd: string,
  ruleProfiles: Record<string, string>,
  profileConfig: RulesConfiguration,
  ruleSetChain: readonly string[],
): Promise<Rule[]> {
  if (!input || (Array.isArray(input) && input.length === 0)) {
    return [];
  }

  if (Array.isArray(input)) {
    return (
      await Promise.all(
        input.map((entry) =>
          // Threads `profileConfig` as well as the chain. It was dropped here before, which was
          // inert only because this branch is unreachable from the glob recursion — it always ran
          // with the top-level empty map. Passing it keeps the fan-out honest for a caller that
          // hands an array and a profile map together.
          loadRulesInChain(
            entry,
            ruleFilter,
            options,
            cwd,
            ruleProfiles,
            profileConfig,
            ruleSetChain,
          ),
        ),
      )
    ).flat();
  }

  // Resolution and loading both go through the shared user-module seam, which is what makes a
  // TypeScript rule loadable: it dispatches on the RESOLVED extension, sending `.ts`/`.mts`/`.cts`
  // through jiti and everything else — every built-in JavaScript rule included — through a plain
  // dynamic import that never pays for jiti. `resolveUserModule` never throws; it answers a
  // result, which is what keeps this error message owned here.
  const resolved = await resolveUserModule(input, cwd);

  if (!resolved.ok) {
    // Two failures, two sentences. `reason` is present only when the specifier resolved to a
    // real file that was then refused for what it IS — a `.yaml`, a `.d.ts` — so reporting
    // "cannot resolve" there tells the user a file they are looking at cannot be found. With no
    // reason there is genuinely nothing to add beyond "not found", and the seam says so by
    // omitting it rather than by inventing a vague one.
    throw new ThymianBaseError(
      resolved.reason === undefined
        ? `Cannot resolve rule source ${input}.`
        : `Cannot load rule source ${input}: ${resolved.reason}.`,
      {
        name: 'RuleLoadError',
        ref: 'https://thymian.dev/references/errors/rule-load-error/',
        // Judged from the SPECIFIER, since a declined result carries no path. That covers the case
        // the user hits — they typed the mis-cased name — but not a lower-case specifier resolving
        // to a mis-cased file on a case-insensitive volume; there the message still names the
        // casing, it just goes unaccompanied.
        suggestions:
          miscasedExtension(input) === undefined
            ? []
            : ['Rename the file so its extension is lower-case.'],
      },
    );
  }

  const module = await loadUserModule(resolved.path);
  const source = describeRuleSource(input, resolved.path);

  if (!('default' in module)) {
    throw new ThymianBaseError(
      // Names the RESOLVED path, not a locally recomputed one: for a name both installed and
      // present in `cwd`, a recomputed path would name a file that was never loaded. It keeps the
      // specifier alongside it when the two differ — see `describeRuleSource`.
      `Rule or rule set at ${source} does not use default export.`,
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

    assertRuleTypeDeclaration(rule, source);

    if (!ruleFilter(rule)) {
      return [];
    }

    assertRuleExecutionInvariant(
      rule,
      source,
      typeOverrideSuggestions(rule, options),
    );

    return [rule];
  }

  if (isRuleSet(ruleOrRuleSet)) {
    // Keyed on the canonical path the seam resolved, never on `input`: the same rule set is reached
    // as a bare specifier at the top level and as a joined glob match one level down, so comparing
    // what the user wrote would miss every cycle. `resolveUserModule` has already run the path
    // through `realpathSync.native`, which is what makes equality here trustworthy.
    const cycleStart = ruleSetChain.indexOf(resolved.path);

    if (cycleStart !== -1) {
      // Sliced from the repeat, not the whole chain: an ancestor entered before the cycle began
      // (X in X -> A -> B -> C -> B) is not part of the loop, and `ruleSetCycleError` promises its
      // `ring` closes — `ring[0]` equal to `ring[last]`. Reporting the full chain here would name X
      // and A as "in the cycle" and point the user at the wrong rule set to fix.
      throw ruleSetCycleError(resolved.path, [
        ...ruleSetChain.slice(cycleStart),
        resolved.path,
      ]);
    }

    const profileName = ruleProfiles[input] ?? DEFAULT_RULE_PROFILE;

    return loadRuleSet(
      ruleOrRuleSet,
      resolved.path,
      ruleFilter,
      options,
      cwd,
      ruleProfiles,
      resolveProfileConfig(ruleOrRuleSet, profileName),
      [...ruleSetChain, resolved.path],
    );
  }

  return [];
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
  // Seeds the rule-set chain empty. Every default lives here rather than on `loadRulesInChain`, so
  // the internal recursion cannot silently fall back to one when it forgets to thread a value.
  return loadRulesInChain(
    input,
    ruleFilter,
    options,
    cwd,
    ruleProfiles,
    profileConfig,
    [],
  );
}
