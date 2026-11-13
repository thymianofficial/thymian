import { type HttpFilterExpression, isRuleCriteria } from '@thymian/core';

/**
 * The rule-context calls whose first argument states the rule's Applicability
 * as a filter expression, readable from outside the rule.
 */
const statingMethods = new Set<PropertyKey>([
  'validateCommonHttpTransactions',
  'validateGroupedCommonHttpTransactions',
]);

/**
 * The rule-context calls that take the Applicability as a plain callback,
 * which says nothing about a transaction the rule did not flag.
 */
const callbackMethods = new Set<PropertyKey>(['validateHttpTransactions']);

/**
 * What a rule stated about its Applicability while it ran: the `appliesTo`
 * expression of every rule-context call it made, or `undefined` when at least
 * one call decided applicability in a callback, or the rule made no call.
 */
export type StatedApplicability = HttpFilterExpression[] | undefined;

/**
 * Wraps a rule context so that the Applicability the rule states to it can be
 * read after the rule ran. The context itself evaluates the rule untouched.
 */
export function observeApplicability<Context extends object>(
  context: Context,
): { context: Context; stated(): StatedApplicability } {
  const expressions: HttpFilterExpression[] = [];
  let decidedInCallback = false;

  const observed = new Proxy(context, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property, target);

      if (typeof value !== 'function') {
        return value;
      }

      return (...args: unknown[]) => {
        if (statingMethods.has(property)) {
          const [first] = args as [
            HttpFilterExpression | { appliesTo: HttpFilterExpression },
          ];
          expressions.push(isRuleCriteria(first) ? first.appliesTo : first);
        } else if (callbackMethods.has(property)) {
          decidedInCallback = true;
        }

        return value.apply(target, args);
      };
    },
  });

  return {
    context: observed,
    stated: () =>
      decidedInCallback || expressions.length === 0 ? undefined : expressions,
  };
}
