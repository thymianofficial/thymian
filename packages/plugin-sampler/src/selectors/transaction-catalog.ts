import type { ThymianFormat, ThymianHttpTransaction } from '@thymian/core';

import {
  compareSelectors,
  encodePath,
  parseSelector,
  type Selector,
  selectorForTransaction,
  type SelectorParts,
} from './selector.js';
import {
  selectorCollisionError,
  unknownSelectorError,
} from './selector-errors.js';
import { pathOf } from './transaction-filter.js';

const MAX_NEAR_MISSES = 5;

export type TransactionCatalogEntry = readonly [
  Selector,
  ThymianHttpTransaction,
];

/**
 * A bijection between the selectors of a loaded `ThymianFormat` and its
 * transactions.
 *
 * Built once per format load and thrown away with the format — it is cheap, and
 * caching it on `format.toHash()` would reintroduce exactly the staleness the
 * selector exists to remove.
 */
export class TransactionCatalog {
  private constructor(
    private readonly bySelector: Map<Selector, ThymianHttpTransaction>,
    private readonly orderedEntries: readonly TransactionCatalogEntry[],
    private readonly selectorByTransactionId: ReadonlyMap<string, Selector>,
    private readonly distinctPaths: readonly string[],
  ) {}

  /**
   * One pass over `format.getThymianHttpTransactions()`, then a sort.
   *
   * @throws `SelectorCollisionError` as soon as two transactions render the same
   * selector. That is the only hard error here. Rendering is total and
   * injective, so no description can make catalog construction impossible and no
   * two *distinct* transactions can collide by accident of encoding: a collision
   * means two sources describe the same method, path, status and media types,
   * and a selector is host-stripped, so nothing distinguishes them. Silently
   * picking one would make a hook target whichever load order won.
   */
  static fromThymianFormat(format: ThymianFormat): TransactionCatalog {
    const bySelector = new Map<Selector, ThymianHttpTransaction>();

    for (const transaction of format.getThymianHttpTransactions()) {
      const selector = selectorForTransaction(transaction);
      const existing = bySelector.get(selector);

      if (existing) {
        throw selectorCollisionError(selector, existing, transaction);
      }

      bySelector.set(selector, transaction);
    }

    const orderedEntries: TransactionCatalogEntry[] = [...bySelector.entries()]
      .sort(([a], [b]) => compareSelectors(a, b))
      .map(([selector, transaction]) => [selector, transaction] as const);

    return new TransactionCatalog(
      bySelector,
      orderedEntries,
      new Map(
        orderedEntries.map(([selector, transaction]) => [
          transaction.transactionId,
          selector,
        ]),
      ),
      [
        ...new Set(
          orderedEntries.map(([, transaction]) => pathOf(transaction)),
        ),
      ].sort(),
    );
  }

  get size(): number {
    return this.bySelector.size;
  }

  /**
   * Selectors sorted by selector.
   *
   * The order is a decision, not an accident: it is the order the generated type
   * surface is emitted in, so sorting is what makes reordering paths or schemas
   * in the source document a drift non-event. Correctness never depends on it.
   */
  selectors(): readonly Selector[] {
    return this.orderedEntries.map(([selector]) => selector);
  }

  entries(): readonly TransactionCatalogEntry[] {
    return this.orderedEntries;
  }

  /**
   * Every distinct path the catalog holds, sorted — the universe a path glob is
   * matched against, and the set a vacuous glob fails against.
   *
   * Derived once at construction, like the selector index: both are read once
   * per hook that targets by filter, and the catalog is rebuilt per format load
   * anyway.
   */
  paths(): readonly string[] {
    return this.distinctPaths;
  }

  /** The selector one transaction renders as, for a diagnostic that has the id. */
  selectorFor(transactionId: string): Selector | undefined {
    return this.selectorByTransactionId.get(transactionId);
  }

  /** Every Transaction, in catalog order. */
  transactions(): readonly ThymianHttpTransaction[] {
    return this.orderedEntries.map(([, transaction]) => transaction);
  }

  /** Never throws. Use where a miss is an expected outcome. */
  tryResolve(selector: string): ThymianHttpTransaction | undefined {
    return this.bySelector.get(selector);
  }

  /**
   * A plain map lookup. Parsing happens only after a miss, to tell the caller
   * whether the selector was malformed or merely unknown — never on the happy
   * path.
   *
   * @throws `MalformedSelectorError` when the input is not a selector,
   * `UnknownSelectorError` when it is well-formed but names nothing loaded.
   */
  resolve(selector: string): ThymianHttpTransaction {
    const transaction = this.bySelector.get(selector);

    if (transaction) {
      return transaction;
    }

    throw unknownSelectorError(
      selector,
      this.nearMissSuggestions(parseSelector(selector)),
    );
  }

  /**
   * What to say to someone who named a selector nothing answers to.
   *
   * Public because the hook loader needs the same sentences without wanting the
   * throw: it has already missed through {@link tryResolve}, and asking for the
   * diagnostic by catching a second, deliberately failing lookup would make the
   * error channel do the work of a query.
   */
  nearMissSuggestions(parts: SelectorParts): string[] {
    // An empty catalog is a state core explicitly warns about ("No nodes found
    // in Thymian format"). Sending the user after a path typo would be wrong
    // advice: no path would have resolved.
    if (this.size === 0) {
      return [
        'No transactions are loaded, so no selector can resolve. Check that your configured specifications were found and describe at least one operation.',
      ];
    }

    const candidates = this.nearMisses(parts);

    if (candidates.length === 0) {
      return [
        'Check the path against the loaded API description — no transaction with that path is loaded.',
      ];
    }

    return [
      'Did you mean one of these selectors?',
      ...candidates.map((candidate) => `"${candidate}"`),
    ];
  }

  /**
   * Deterministic rank buckets, in catalog order: same method and path first,
   * then the same path under another method. No fuzzy matching — it would add a
   * dependency and make the ordering unexplainable.
   */
  private nearMisses(parts: SelectorParts): Selector[] {
    const sameMethod: Selector[] = [];
    const otherMethod: Selector[] = [];
    const path = encodePath(parts.path);

    for (const [selector, transaction] of this.orderedEntries) {
      if (encodePath(transaction.thymianReq.path) !== path) {
        continue;
      }

      if (transaction.thymianReq.method.toUpperCase() === parts.method) {
        sameMethod.push(selector);
      } else {
        otherMethod.push(selector);
      }
    }

    return [...sameMethod, ...otherMethod].slice(0, MAX_NEAR_MISSES);
  }
}
