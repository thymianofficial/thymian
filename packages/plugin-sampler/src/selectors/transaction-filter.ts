import type { ThymianHttpTransaction } from '@thymian/core';

import { matchesPathGlob } from './path-glob.js';
import { canonicalPath } from './selector.js';

/**
 * A path glob, by shape.
 *
 * A string with no `*` is not a `PathGlob`, so it has to be an exact path —
 * which is what keeps a typo'd exact path a compile error while a glob stays a
 * plain string. The shape type never touches the `Path` union: validating a
 * glob *against* the union was measured and rejected on language-server cost,
 * and vacuousness is checked at run and validate time instead.
 *
 * {@link PATH_GLOB_SOURCE} is the same type as text, so the generated surface
 * and this module cannot drift on it.
 */
export type PathGlob = `${string}*${string}`;

/** {@link PathGlob} as source text, for the generated declaration file. */
export const PATH_GLOB_SOURCE = '`${string}*${string}`';

/**
 * The fields a filter can constrain, as the runtime sees them.
 *
 * Every one is a closed, spec-derived union in the *generated* surface, which is
 * what makes a stale value a compile error. Here they are the widest thing a
 * `.js` hook file could pass, because that file is not type-checked — so the
 * runtime validates shapes itself rather than trusting them.
 */
export type FilterFields = {
  readonly method?: string | readonly string[];
  readonly status?: number | readonly number[];
  readonly statusClass?: string | readonly string[];
  readonly path?: string | PathGlob | readonly (string | PathGlob)[];
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

/** A status class: the first digit of a status, spelled `1XX` … `5XX`. */
const STATUS_CLASS = /^[1-5]XX$/;

/**
 * One field of a filter: how to read it off a Transaction, whether a value is
 * even the right shape, and whether a value accepts a Transaction.
 *
 * A table rather than six hand-written blocks, because a field was previously
 * four separate edits — the type, the key list, the matcher and the path
 * collector — and the one that got forgotten was the validation.
 */
type FieldSpec = {
  /** Whether one value is a legal value for this field at all. */
  valid: (value: unknown) => boolean;
  /** What a legal value looks like, for the diagnostic. */
  expected: string;
  /** Whether one value accepts this Transaction. */
  accepts: (value: unknown, transaction: ThymianHttpTransaction) => boolean;
};

const FIELDS = {
  method: {
    valid: (value) => typeof value === 'string',
    expected: 'an HTTP method',
    // Methods are compared case-insensitively because a selector uppercases
    // them, so `get` and `GET` are the same method by construction.
    accepts: (value, { thymianReq }) =>
      String(value).toUpperCase() === thymianReq.method.toUpperCase(),
  },
  status: {
    valid: (value) => typeof value === 'number' && Number.isInteger(value),
    expected: 'a status code, as a number',
    accepts: (value, { thymianRes }) => value === thymianRes.statusCode,
  },
  statusClass: {
    valid: (value) => typeof value === 'string' && STATUS_CLASS.test(value),
    expected: 'a status class: "1XX", "2XX", "3XX", "4XX" or "5XX"',
    // The first digit, not core's list of registered codes: a status class is a
    // range, and a description is free to declare a 418 or a vendor's 499.
    accepts: (value, { thymianRes }) =>
      String(thymianRes.statusCode).startsWith(String(value)[0] as string),
  },
  path: {
    valid: (value) => typeof value === 'string',
    expected: 'a path or a path glob',
    accepts: (value, transaction) =>
      matchesPathGlob(String(value), pathOf(transaction)),
  },
  requestMediaType: {
    valid: (value) => typeof value === 'string',
    expected: 'a media type',
    accepts: (value, { thymianReq }) => value === thymianReq.mediaType,
  },
  responseMediaType: {
    valid: (value) => typeof value === 'string',
    expected: 'a media type',
    accepts: (value, { thymianRes }) => value === thymianRes.mediaType,
  },
} satisfies Record<string, FieldSpec>;

export type FilterFieldName = keyof typeof FIELDS;

const FIELD_NAMES = Object.keys(FIELDS) as FilterFieldName[];

/** The path a filter compares against: the description's own spelling. */
export function pathOf(transaction: ThymianHttpTransaction): string {
  return canonicalPath(transaction.thymianReq.path);
}

function asList(value: unknown): readonly unknown[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

/**
 * Whether `value` is shaped like a filter.
 *
 * One known field is enough. Requiring *every* key to be known meant a single
 * typo — `{ path: '/v1/**', tag: 'x' }` — was reported as "not a filter at
 * all", which sends the reader looking for a selector they never wrote;
 * {@link filterProblems} names the unknown key instead.
 */
export function isTransactionFilter(
  value: unknown,
): value is TransactionFilter {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.keys(value).some(
    (key) => key === 'not' || (FIELD_NAMES as readonly string[]).includes(key),
  );
}

/** One thing wrong with a filter, in the words a diagnostic uses. */
export type FilterProblem = string;

/**
 * Everything wrong with a filter's own text, before any Transaction is
 * consulted.
 *
 * Separate from matching because a filter that cannot mean anything is a
 * different fault from one that means something nothing satisfies. Reporting a
 * mistyped `'4xx'` as "all valid but intersects nothing" is the wrong sentence,
 * and letting `{ method: 42 }` through produced a bare `TypeError` naming no
 * file at all.
 */
export function filterProblems(filter: TransactionFilter): FilterProblem[] {
  const problems: FilterProblem[] = [];
  const record = filter as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (key === 'not') {
      for (const exclusion of asList(record[key])) {
        if (
          typeof exclusion !== 'object' ||
          exclusion === null ||
          Array.isArray(exclusion)
        ) {
          problems.push(
            '"not" takes a filter, or a list of filters, and nothing else',
          );

          continue;
        }

        problems.push(
          ...filterProblems(exclusion as TransactionFilter).map(
            (problem) => `inside "not": ${problem}`,
          ),
        );
      }

      continue;
    }

    if (!(FIELD_NAMES as readonly string[]).includes(key)) {
      problems.push(
        `"${key}" is not a filter field; the fields are ${FIELD_NAMES.map((name) => `"${name}"`).join(', ')} and "not"`,
      );

      continue;
    }

    const spec = FIELDS[key as FilterFieldName];

    for (const value of asList(record[key])) {
      if (!spec.valid(value)) {
        problems.push(
          `"${key}" was given ${JSON.stringify(value) ?? String(value)}, but it takes ${spec.expected}`,
        );
      }
    }
  }

  return problems;
}

/** Whether every field present in `fields` accepts `transaction`. */
function matchesFields(
  fields: FilterFields,
  transaction: ThymianHttpTransaction,
): boolean {
  const record = fields as Record<string, unknown>;

  return FIELD_NAMES.every((name) => {
    const values = asList(record[name]);

    return (
      values.length === 0 ||
      values.some((value) => FIELDS[name].accepts(value, transaction))
    );
  });
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
    matchesFields(exclusion as FilterFields, transaction),
  );
}

/** Every path value a filter mentions, including the ones inside `not`. */
export function pathValuesOf(filter: TransactionFilter): readonly string[] {
  const own = asList(filter.path).filter(
    (value): value is string => typeof value === 'string',
  );
  const excluded = asList(filter.not).flatMap((exclusion) =>
    asList((exclusion as Record<string, unknown>)['path']).filter(
      (value): value is string => typeof value === 'string',
    ),
  );

  return [...own, ...excluded];
}
