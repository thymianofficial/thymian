import {
  type CommonHttpRuleCriteria,
  type HttpFilterExpression,
  isRuleCriteria,
  type RuleFnResult,
} from '@thymian/core';

/**
 * How the rule-context calls of one validation context take the rule's
 * Applicability. The contexts differ: `validateHttpTransactions` takes a plain
 * callback in `static` and a filter expression in `analytics`.
 */
export type ApplicabilityCalls = {
  /**
   * The calls whose first argument states the Applicability as a filter
   * expression, readable from outside the rule.
   */
  stating: ReadonlySet<PropertyKey>;
  /**
   * The calls that say nothing about a transaction the rule did not flag:
   * they take the Applicability as a plain callback, or take none.
   */
  notStating: ReadonlySet<PropertyKey>;
};

/**
 * What a rule stated about its Applicability while it ran: the `appliesTo`
 * expression of every rule-context call it made, or `undefined` when at least
 * one call stated none (it decided in a callback, took no applicability, or
 * gave a lone positional expression, which is its violation condition), or the
 * rule made no call.
 */
export type StatedApplicability = HttpFilterExpression[] | undefined;

/**
 * Wraps a rule context so that the Applicability the rule states to it can be
 * read after the rule ran. The context itself evaluates the rule untouched.
 */
export function observeApplicability<Context extends object>(
  context: Context,
  { stating, notStating }: ApplicabilityCalls,
): { context: Context; stated(): StatedApplicability } {
  const expressions: HttpFilterExpression[] = [];
  let unstated = false;

  const observed = new Proxy(context, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property, target);

      if (typeof value !== 'function') {
        return value;
      }

      return (...args: unknown[]) => {
        if (stating.has(property)) {
          const [first] = args as [
            HttpFilterExpression | { appliesTo: HttpFilterExpression },
          ];
          if (isRuleCriteria(first)) {
            expressions.push(first.appliesTo);
          } else if (args.length > 1) {
            expressions.push(first);
          } else {
            // A lone positional expression is the violation condition, not
            // an applicability: every transaction it does not match is one
            // the rule accepted.
            unstated = true;
          }
        } else if (notStating.has(property)) {
          unstated = true;
        }

        return value.apply(target, args);
      };
    },
  });

  return {
    context: observed,
    stated: () =>
      unstated || expressions.length === 0 ? undefined : expressions,
  };
}

/**
 * The transactions the stated Applicability accepts, asked of the engine's
 * context in a call of its own; `undefined` when the rule stated none, so that
 * every transaction counts as applicable.
 *
 * The context is one the rule did not run on. Whatever it does not locate on
 * a transaction is left out.
 */
export function applicableTransactions(
  stated: StatedApplicability,
  context: {
    validateCommonHttpTransactions(
      criteria: CommonHttpRuleCriteria,
    ): RuleFnResult[];
  },
): Set<string> | undefined {
  if (stated === undefined) {
    return undefined;
  }

  return new Set(
    stated
      .flatMap((appliesTo) =>
        context.validateCommonHttpTransactions({
          appliesTo,
          violatedWhen: (_req, _res, location): RuleFnResult[] => [
            { location, findings: [] },
          ],
        }),
      )
      .flatMap(({ location }) =>
        typeof location === 'string' ? [] : [location.elementId],
      ),
  );
}
