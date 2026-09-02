import type { ThymianHttpTransaction } from '@thymian/core';

import { hasWildcard, matchesPathGlob } from '../selectors/path-glob.js';
import { parseSelector, type Selector } from '../selectors/selector.js';
import type { TransactionCatalog } from '../selectors/transaction-catalog.js';
import {
  filterProblems,
  isTransactionFilter,
  matchesTransactionFilter,
  pathValuesOf,
  type TransactionFilter,
} from '../selectors/transaction-filter.js';
import type { HookDiagnostic } from './hook-diagnostics.js';
import type { CollectedRegistration } from './load-user-hooks.js';

const MAX_NEAR_PATHS = 5;

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

  for (const selector of selectors) {
    const transaction = catalog.tryResolve(selector);

    if (!transaction) {
      diagnostics.push({
        ...where,
        reason: `${kind} targets the selector "${selector}", which names no transaction in the loaded API description`,
        suggestions: catalog.nearMissSuggestions(parseSelector(selector)),
      });

      continue;
    }

    resolved.push(transaction);
  }

  return resolved;
}

/**
 * The Transactions a filter covers.
 *
 * Faults are reported in the order they stop mattering: a filter whose text
 * cannot mean anything is not asked what it matches, and a vacuous path value
 * is named individually before the filter as a whole is called empty.
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
      suggestions: nearestPaths(value, paths),
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

/**
 * Paths that share the vacuous value's longest literal prefix, so the reader is
 * pointed at the subtree they meant rather than at the whole description.
 *
 * No fuzzy matching: it would add a dependency and make the ordering
 * unexplainable.
 */
function nearestPaths(value: string, paths: readonly string[]): string[] {
  const segments = value.split('/');

  for (let depth = segments.length - 1; depth > 0; depth--) {
    const prefix = `${segments.slice(0, depth).join('/')}/`;
    const candidates = paths
      .filter((path) => path.startsWith(prefix))
      .slice(0, MAX_NEAR_PATHS);

    if (candidates.length > 0) {
      return [
        `Paths under "${prefix}" are:`,
        ...candidates.map((path) => `"${path}"`),
      ];
    }
  }

  return [
    `No path in the loaded API description begins with "${segments[1] ? `/${segments[1]}` : value}".`,
  ];
}
