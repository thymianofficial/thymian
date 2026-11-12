export const RULE_NAME = 'no-repeated-rule-name';

/**
 * Reports a rule's name written out a second time in the file that declares
 * it — typically again as the title of a `rule-skip` finding — so a rename
 * cannot update one copy and miss the other. The fix is the convention the
 * rule sets already follow: `const NAME = '…'`, passed to `httpRule(NAME)`
 * and referenced wherever else the name is needed.
 *
 * "The rule's name" is whatever the file's `httpRule(...)` call declares: a
 * string literal, an interpolation-free template literal, or a `const`
 * initialised with one. Taking it from the call rather than from a list of
 * rule-id prefixes covers every rule package, present and future, and
 * survives a prefix being renamed. Only a string whose whole value equals
 * the name counts as a copy: prose mentioning the name, an interpolating
 * template literal and comments do not. Pure syntax plus scope analysis, so
 * no type information is needed.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Disallow writing a rule's name more than once in the file that declares it.",
    },
    schema: [],
    messages: {
      repeatedName:
        "The rule name '{{name}}' is already declared by httpRule(...). Declare it once as `const NAME = '{{name}}'` and reference NAME here.",
    },
  },
  create(context) {
    const strings = [];
    const declarations = [];

    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          strings.push({ node, value: node.value });
        }
      },
      TemplateLiteral(node) {
        const value = staticTemplateValue(node);
        if (value !== undefined) {
          strings.push({ node, value });
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'httpRule' &&
          node.arguments.length > 0
        ) {
          declarations.push(node.arguments[0]);
        }
      },
      'Program:exit'() {
        const names = new Map();
        for (const argument of declarations) {
          const declared = resolveName(context, argument);
          if (declared) {
            names.set(declared.value, declared.node);
          }
        }

        for (const { node, value } of strings) {
          if (names.has(value) && names.get(value) !== node) {
            context.report({
              node,
              messageId: 'repeatedName',
              data: { name: value },
            });
          }
        }
      },
    };
  },
};

function staticTemplateValue(node) {
  return node.expressions.length === 0
    ? node.quasis[0].value.cooked
    : undefined;
}

function stringValue(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral') {
    return staticTemplateValue(node);
  }
  return undefined;
}

// The name the httpRule(...) argument stands for, and the one node allowed
// to spell it: the argument itself, or the initialiser of the `const` it
// names. Anything else — a call, a non-const binding — has no name this rule
// can see, and is left alone.
function resolveName(context, argument) {
  const direct = stringValue(argument);
  if (direct !== undefined) {
    return { value: direct, node: argument };
  }
  if (argument.type !== 'Identifier') {
    return undefined;
  }

  let scope = context.sourceCode.getScope(argument);
  while (scope) {
    const variable = scope.set.get(argument.name);
    if (variable) {
      const definition = variable.defs[0];
      if (
        definition?.type === 'Variable' &&
        definition.parent.kind === 'const' &&
        definition.node.init
      ) {
        const value = stringValue(definition.node.init);
        if (value !== undefined) {
          return { value, node: definition.node.init };
        }
      }
      return undefined;
    }
    scope = scope.upper;
  }
  return undefined;
}
