import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';

import { rule, RULE_NAME } from './require-rule-tags.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

ruleTester.run(RULE_NAME, rule, {
  valid: [
    {
      code: `
        export default httpRule('tagged')
          .severity('error')
          .type('informational')
          .tags('security:cors')
          .done();
      `,
    },
    {
      // A shared tag constant is a legitimate non-literal argument — the
      // closed RuleTag union is what guarantees validity, not this rule.
      code: `
        export default httpRule('tagged-via-constant')
          .severity('error')
          .type('informational')
          .tags(SHARED_TAG)
          .done();
      `,
    },
    {
      // RuleTester registers the rule under test as '@rule-tester/<name>'
      // internally; a real rule file suppresses with the production id the
      // rule is actually registered under, 'thymian-internal/require-rule-tags'.
      code: `
        // eslint-disable-next-line @rule-tester/require-rule-tags -- nothing in the vocabulary fits
        export default httpRule('judged-untaggable')
          .severity('error')
          .type('informational')
          .done();
      `,
    },
  ],
  invalid: [
    {
      code: `
export default httpRule('untagged')
  .severity('error')
  .type('informational')
  .done();
      `,
      errors: [{ messageId: 'missingTags', type: 'CallExpression', line: 2 }],
    },
    {
      code: `
        export default httpRule('empty-tags-call')
          .severity('error')
          .type('informational')
          .tags()
          .done();
      `,
      errors: [{ messageId: 'missingTags', type: 'CallExpression' }],
    },
  ],
});
