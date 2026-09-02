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
    private readonly selectorByTransactionId: Map<string, Selector>,
    private readonly orderedEntries: readonly TransactionCatalogEntry[],
  ) {}

  /**
   * One pass over `format.getThymianHttpTransactions()`, then a sort.
   *
   * @throws `SelectorCollisionError` as soon as two transactions render the same
   * selector. That is the only hard error here: rendering is total, so no
   * description can make catalog construction impossible — only an ambiguous one
   * can, and an ambiguity must not be resolved silently.
   */
  static fromThymianFormat(format: ThymianFormat): TransactionCatalog {
    const bySelector = new Map<Selector, ThymianHttpTransaction>();
    const selectorByTransactionId = new Map<string, Selector>();

    for (const transaction of format.getThymianHttpTransactions()) {
      const selector = selectorForTransaction(transaction);
      const existing = bySelector.get(selector);

      if (existing) {
        throw selectorCollisionError(selector, existing, transaction);
      }

      bySelector.set(selector, transaction);
      selectorByTransactionId.set(transaction.transactionId, selector);
    }

    const orderedEntries: TransactionCatalogEntry[] = [...bySelector.entries()]
      .sort(([a], [b]) => compareSelectors(a, b))
      .map(([selector, transaction]) => [selector, transaction] as const);

    return new TransactionCatalog(
      bySelector,
      selectorByTransactionId,
      orderedEntries,
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

  selectorFor(transactionId: string): Selector | undefined {
    return this.selectorByTransactionId.get(transactionId);
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
      this.suggestionsFor(parseSelector(selector)),
    );
  }

  private suggestionsFor(parts: SelectorParts): string[] {
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
