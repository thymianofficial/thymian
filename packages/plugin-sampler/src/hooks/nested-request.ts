import { ThymianBaseError } from '@thymian/core';

import type { Selector } from '../selectors/selector.js';

/**
 * The Selectors whose pipelines are currently on the stack.
 *
 * Travels with the hook context rather than living in the runner, because that
 * is what makes the guard reflect *this* call's ancestry instead of whatever
 * the runner happened to be doing last.
 */
export type SelectorChain = readonly Selector[];

/**
 * A seeding call has re-entered a Transaction already on the stack.
 *
 * Printing the chain is the whole point: `A → B → A` is a mistake three files
 * apart, and the middle of the cycle is where the fix goes. Without it the run
 * would recurse until the stack gave out, and a stack overflow names nothing.
 */
export function requestCycleError(
  chain: SelectorChain,
  selector: Selector,
): ThymianBaseError {
  const path = [...chain, selector].map((entry) => `"${entry}"`).join('\n  → ');

  return new ThymianBaseError(
    `A cross-endpoint request would re-enter "${selector}", which is already running.`,
    {
      name: 'RequestCycleError',
      ref: 'https://thymian.dev/references/errors/request-cycle-error/',
      suggestions: [
        `The chain is:\n  ${path}`,
        'Break the cycle, or pass `{ runHooks: false }` to seed from the raw request without running the target’s hooks.',
      ],
    },
  );
}

/** Whether `selector` is already on `chain`. */
export function isOnChain(chain: SelectorChain, selector: Selector): boolean {
  return chain.includes(selector);
}
