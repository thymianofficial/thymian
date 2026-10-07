import type { ThymianHttpTransaction } from '@thymian/core';

import { nearestPathHints } from '../selectors/nearest-paths.js';
import { hasWildcard, matchesPathGlob } from '../selectors/path-glob.js';
import {
  isSelector,
  malformedSelectorHints,
  parseSelector,
  type Selector,
} from '../selectors/selector.js';
import type { TransactionCatalog } from '../selectors/transaction-catalog.js';
import {
  emptyValueFields,
  filterProblems,
  isTransactionFilter,
  matchesTransactionFilter,
  pathValuesOf,
  type TransactionFilter,
} from '../selectors/transaction-filter.js';
import type { HookDiagnostic } from './hook-diagnostics.js';
import type { CollectedRegistration } from './load-user-hooks.js';

type Where = { file: string; exportName: string };

/**
 * The selectors a target names, or `undefined` when it is not a selector form.
 *
 * Takes `unknown` rather than a target type: a `.js` hook file is legal input
 * and is not type-checked, so the value here is whatever the user passed.
 */
function selectorsOf(target: unknown): readonly Selector[] | undefined {
  if (typeof target === 'string') {
    return [target];
  }

  if (Array.isArray(target) && target.every((v) => typeof v === 'string')) {
    return target as readonly Selector[];
  }

  return undefined;
}

/**
 * The Transactions a target covers, reporting whatever stops it covering any.
 *
 * A target that resolves to nothing is a diagnostic, never an empty result that
 * runs quietly. There are four ways a hook can silently stop doing its job — a
 * dangling Selector, a value that is not a legal filter value, a path or glob
 * that names nothing, and a filter whose legal values intersect nothing — and
 * each one gets its own sentence, because "this matched nothing" is true and
 * useless when the cause is one typo.
 */
export function resolveTargeting(
  kind: string,
  target: unknown,
  entry: CollectedRegistration,
  catalog: TransactionCatalog,
  diagnostics: HookDiagnostic[],
): readonly ThymianHttpTransaction[] {
  const where = { file: entry.file, exportName: entry.exportName };
  const selectors = selectorsOf(target);

  if (selectors) {
    return resolveSelectors(kind, selectors, where, catalog, diagnostics);
  }

  if (isTransactionFilter(target)) {
    return resolveFilter(kind, target, where, catalog, diagnostics);
  }

  diagnostics.push({
    ...where,
    reason: `${kind} was given a target that is neither a selector, a list of selectors, nor a transaction filter`,
  });

  return [];
}

function resolveSelectors(
  kind: string,
  selectors: readonly Selector[],
  where: Where,
  catalog: TransactionCatalog,
  diagnostics: HookDiagnostic[],
): readonly ThymianHttpTransaction[] {
  if (selectors.length === 0) {
    diagnostics.push({
      ...where,
      reason: `${kind} was given an empty list of selectors, so it targets nothing`,
    });

    return [];
  }

  const resolved: ThymianHttpTransaction[] = [];
  // Naming one transaction twice targets it once.
  //
  // Composing lists is the ordinary way to build a target —
  // `beforeEach([...PUBLIC, ...ADMIN], fn)` — and one transaction in both
  // halves is a duplicate the author cannot see. Bound twice, the hook runs
  // twice per request, and a `defineSample` written that way reports a
  // conflict against itself.
  const bound = new Set<string>();

  for (const selector of selectors) {
    const transaction = catalog.tryResolve(selector);

    if (transaction) {
      if (!bound.has(transaction.transactionId)) {
        bound.add(transaction.transactionId);
        resolved.push(transaction);
      }

      continue;
    }

    // A target is user input like any other, and a hand-authored selector can
    // fail to even parse — never thrown from here, or a single typo'd target
    // would crash `validate`, `show` and `sync` instead of being recorded
    // against the hook that carries it. `isSelector` is what tells "malformed"
    // apart from "well-formed but unknown", which decides whether a grammar
    // hint or a near-miss is the useful thing to say.
    if (!isSelector(selector)) {
      diagnostics.push({
        ...where,
        reason: `${kind} targets "${selector}", which is not a valid transaction selector`,
        suggestions: malformedSelectorHints(selector),
      });

      continue;
    }

    diagnostics.push({
      ...where,
      reason: `${kind} targets the selector "${selector}", which names no transaction in the loaded API description`,
      suggestions: catalog.nearMissSuggestions(parseSelector(selector)),
    });
  }

  return resolved;
}

/**
 * The Transactions a filter covers.
 *
 * Faults are reported in the order they stop mattering: a filter whose text
 * cannot mean anything is not asked what it matches, an empty value array is
 * named before the catalog is even consulted, and a vacuous path value is
 * named individually before the filter as a whole is called empty.
 */
function resolveFilter(
  kind: string,
  filter: TransactionFilter,
  where: Where,
  catalog: TransactionCatalog,
  diagnostics: HookDiagnostic[],
): readonly ThymianHttpTransaction[] {
  const problems = filterProblems(filter);

  if (problems.length > 0) {
    diagnostics.push({
      ...where,
      reason: `${kind} was given a filter that cannot mean anything: ${problems.join('; ')}`,
    });

    return [];
  }

  // A field given an explicit, empty value array is a shape the grammar
  // accepts — it is not a "cannot mean anything" fault — but it is a
  // disjunction of zero alternatives, which matches nothing by construction.
  // Named here, the same way an empty list of selectors is: a hook must never
  // silently apply to every Transaction because a computed array came back
  // empty.
  const emptyFields = emptyValueFields(filter);

  if (emptyFields.length > 0) {
    const plural = emptyFields.length > 1;
    const names = emptyFields.map((name) => `"${name}"`).join(', ');

    diagnostics.push({
      ...where,
      reason: `${kind} targets a filter whose ${plural ? 'fields' : 'field'} ${names} ${plural ? 'were' : 'was'} given an empty list of values, so it targets nothing`,
    });

    return [];
  }

  const paths = catalog.paths();

  if (paths.length === 0) {
    diagnostics.push({
      ...where,
      reason: `${kind} targets a filter, but no transactions are loaded, so no filter can match`,
      suggestions: [
        'Check that your configured specifications were found and describe at least one operation.',
      ],
    });

    return [];
  }

  let vacuous = false;

  for (const value of pathValuesOf(filter)) {
    if (paths.some((path) => matchesPathGlob(value, path))) {
      continue;
    }

    vacuous = true;

    diagnostics.push({
      ...where,
      reason: hasWildcard(value)
        ? `${kind} targets the path glob "${value}", which matches no path in the loaded API description`
        : `${kind} targets the path "${value}", which no path in the loaded API description is spelled as`,
      suggestions: nearestPathHints(value, paths),
    });
  }

  if (vacuous) {
    return [];
  }

  const matched = catalog
    .transactions()
    .filter((transaction) => matchesTransactionFilter(filter, transaction));

  if (matched.length === 0) {
    diagnostics.push({
      ...where,
      reason: `${kind} targets a filter whose values are all valid but intersect no transaction in the loaded API description`,
      suggestions: [
        'Every field of a filter must hold at the same time, so check whether the combination can exist — a method and a status that never occur together, for example.',
      ],
    });
  }

  return matched;
}
