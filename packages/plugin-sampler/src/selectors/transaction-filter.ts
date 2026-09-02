import {
  isHttpStatusCodeRange,
  statusCodeMatchesRange,
  type ThymianHttpTransaction,
} from '@thymian/core';

import { matchesPathGlob } from './path-glob.js';
import { encodePath } from './selector.js';

/**
 * A glob, by shape. A string with no `*` is not a `PathGlob`, so it has to be
 * an exact path — which is what keeps a typo'd exact path a compile error while
 * the glob itself stays a plain string. The shape type never touches the `Path`
 * union: validating a glob *against* the union was measured and rejected on
 * language-server cost, and vacuousness is checked at run and validate time
 * instead.
 */
export type PathGlob = `${string}*${string}`;

/**
 * The fields a filter can constrain. Every one is a closed, spec-derived union
 * in the generated surface, so a stale value is a compile error; `path` is the
 * one field that also admits a glob.
 */
export type FilterFields = {
  readonly method?: string | readonly string[];
  readonly status?: number | readonly number[];
  readonly statusClass?: string | readonly string[];
  readonly path?: string | readonly string[];
  readonly requestMediaType?: string | readonly string[];
  readonly responseMediaType?: string | readonly string[];
};

/**
 * Targets a set of Transactions.
 *
 * Fields **AND**-combine; an array within a field **OR**-combines. `not` takes
 * filter fields and excludes anything matching them — one level deep by
 * construction, because `FilterFields` has no `not` of its own.
 */
export type TransactionFilter = FilterFields & {
  readonly not?: FilterFields | readonly FilterFields[];
};

const FILTER_FIELDS = [
  'method',
  'status',
  'statusClass',
  'path',
  'requestMediaType',
  'responseMediaType',
] as const;

/** Whether `value` is a filter rather than a Selector or a list of them. */
export function isTransactionFilter(
  value: unknown,
): value is TransactionFilter {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const keys = Object.keys(value);

  return (
    keys.length > 0 &&
    keys.every(
      (key) =>
        key === 'not' || (FILTER_FIELDS as readonly string[]).includes(key),
    )
  );
}

function asList<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value as T];
}

/** The path a filter compares against, spelled as a selector spells it. */
function pathOf(transaction: ThymianHttpTransaction): string {
  const rendered = encodePath(transaction.thymianReq.path);

  // `encodePath` quotes a path the bare selector form cannot carry. A filter
  // compares against the path itself, so the quoting is undone here — a glob is
  // written the way the description spells the path.
  return rendered.startsWith('"')
    ? rendered.slice(1, -1).replace(/\\(.)/g, '$1')
    : rendered;
}

/** Whether every field present in `fields` accepts `transaction`. */
function matchesFields(
  fields: FilterFields,
  transaction: ThymianHttpTransaction,
): boolean {
  const { thymianReq: req, thymianRes: res } = transaction;

  const methods = asList(fields.method);

  if (
    methods.length > 0 &&
    !methods.some((method) => method.toUpperCase() === req.method.toUpperCase())
  ) {
    return false;
  }

  const statuses = asList(fields.status);

  if (statuses.length > 0 && !statuses.includes(res.statusCode)) {
    return false;
  }

  const statusClasses = asList(fields.statusClass);

  if (
    statusClasses.length > 0 &&
    !statusClasses.some(
      (statusClass) =>
        isHttpStatusCodeRange(statusClass) &&
        statusCodeMatchesRange(res.statusCode, statusClass),
    )
  ) {
    return false;
  }

  const paths = asList(fields.path);

  if (paths.length > 0) {
    const path = pathOf(transaction);

    if (!paths.some((candidate) => matchesPathGlob(candidate, path))) {
      return false;
    }
  }

  const requestMediaTypes = asList(fields.requestMediaType);

  if (
    requestMediaTypes.length > 0 &&
    !requestMediaTypes.includes(req.mediaType)
  ) {
    return false;
  }

  const responseMediaTypes = asList(fields.responseMediaType);

  if (
    responseMediaTypes.length > 0 &&
    !responseMediaTypes.includes(res.mediaType)
  ) {
    return false;
  }

  return true;
}

/**
 * `matches(t) = positive(t) && !not.some(n => n(t))`.
 *
 * An empty positive side matches everything, which is what makes
 * `{ not: { … } }` mean "all but these" without a second spelling.
 */
export function matchesTransactionFilter(
  filter: TransactionFilter,
  transaction: ThymianHttpTransaction,
): boolean {
  if (!matchesFields(filter, transaction)) {
    return false;
  }

  return !asList(filter.not).some((exclusion) =>
    matchesFields(exclusion, transaction),
  );
}

/** Every path value a filter mentions, including the ones inside `not`. */
export function pathValuesOf(filter: TransactionFilter): readonly string[] {
  return [
    ...asList(filter.path),
    ...asList(filter.not).flatMap((exclusion) => asList(exclusion.path)),
  ];
}

/** Every path the catalog holds, as a filter compares them. */
export function catalogPaths(
  transactions: readonly ThymianHttpTransaction[],
): readonly string[] {
  return [...new Set(transactions.map(pathOf))].sort();
}
