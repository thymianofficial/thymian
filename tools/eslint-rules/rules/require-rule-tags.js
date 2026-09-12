export const RULE_NAME = 'require-rule-tags';

/**
 * Warns when an `httpRule(...)` chain never calls `.tags(...)` with at least
 * one argument. Untagged is legal — a rule author who has looked and
 * concluded nothing fits records that with a suppression comment on the
 * `httpRule(...)` line, which is why this reports there rather than on the
 * chain's `.done()`. No type information is needed: this is pure syntax, so
 * the rule has no parser-services cost.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require an httpRule(...) chain to call .tags(...), or to suppress with a reason.',
    },
    schema: [],
    messages: {
      missingTags:
        'This rule has no .tags() call. Add one, or suppress this warning with a comment explaining why no concern tag fits.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          node.callee.name !== 'httpRule'
        ) {
          return;
        }

        if (!chainCallsTags(node)) {
          context.report({ node, messageId: 'missingTags' });
        }
      },
    };
  },
};

// Walks outward from the `httpRule(...)` call through the builder chain —
// each link is a MemberExpression immediately wrapped by the CallExpression
// that invokes it (`.severity(...)`, `.tags(...)`, ...) — looking for a
// `.tags(...)` call carrying at least one argument. Arguments aren't
// required to be literals: a shared tag constant is legitimate, and the
// closed RuleTag union is what guarantees validity, not this rule.
function chainCallsTags(declarationCall) {
  let current = declarationCall;

  while (
    current.parent?.type === 'MemberExpression' &&
    current.parent.object === current &&
    current.parent.parent?.type === 'CallExpression' &&
    current.parent.parent.callee === current.parent
  ) {
    const member = current.parent;
    const call = current.parent.parent;

    if (
      member.property.type === 'Identifier' &&
      member.property.name === 'tags' &&
      call.arguments.length > 0
    ) {
      return true;
    }

    current = call;
  }

  return false;
}
