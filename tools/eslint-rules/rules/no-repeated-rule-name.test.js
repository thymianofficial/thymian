import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';

import { rule, RULE_NAME } from './no-repeated-rule-name.js';

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
      // The name written once, in httpRule(...).
      code: `
        export default httpRule('rfc9110/once')
          .severity('error')
          .done();
      `,
    },
    {
      // The convention: one const, referenced wherever the name is needed.
      code: `
        const NAME = 'thymian/named-once';
        export default httpRule(NAME)
          .rule(() => [{ findings: [{ title: NAME, kind: 'rule-skip' }] }])
          .done();
      `,
    },
    {
      // Prose that merely mentions the name is not a second copy of it.
      code: `
        export default httpRule('rfc6797/mentioned')
          .description('See rfc6797/mentioned for details.')
          .done();
      `,
    },
    {
      // Comments are not code: a stale comment cannot change what the rule
      // reports.
      code: `
        // rfc-6265bis/commented is checked here.
        export default httpRule('rfc-6265bis/commented').done();
      `,
    },
    {
      // A template literal that interpolates is built from parts, not a
      // copy of the name.
      code: `
        const NAME = 'thymian/interpolated';
        export default httpRule(NAME)
          .rule(() => [{ findings: [{ title: \`\${NAME}\`, kind: 'rule-skip' }] }])
          .done();
      `,
    },
    {
      // No httpRule(...) call: nothing names a rule here.
      code: `
        const a = 'thymian/not-a-rule';
        const b = 'thymian/not-a-rule';
      `,
    },
  ],
  invalid: [
    {
      // The case that motivated the rule: a rule-skip finding repeating the
      // name the httpRule(...) call already declared.
      code: `
export default httpRule('thymian/repeated')
  .rule(() => [
    { findings: [{ title: 'thymian/repeated', kind: 'rule-skip' }] },
    { findings: [{ title: 'thymian/repeated', kind: 'rule-skip' }] },
  ])
  .done();
      `,
      errors: [
        { messageId: 'repeatedName', type: 'Literal', line: 4 },
        { messageId: 'repeatedName', type: 'Literal', line: 5 },
      ],
    },
    {
      // A const exists, but a literal copy was left behind beside it.
      code: `
        const NAME = 'rfc9110/half-migrated';
        export default httpRule(NAME)
          .rule(() => [{ findings: [{ title: 'rfc9110/half-migrated' }] }])
          .done();
      `,
      errors: [{ messageId: 'repeatedName', type: 'Literal' }],
    },
    {
      // A template literal without interpolation is still a literal copy.
      code: `
        export default httpRule('rfc6797/template-copy')
          .rule(() => [{ findings: [{ title: \`rfc6797/template-copy\` }] }])
          .done();
      `,
      errors: [{ messageId: 'repeatedName', type: 'TemplateLiteral' }],
    },
    {
      // The name declared through a template literal counts as well.
      code: `
        export default httpRule(\`rfc-6265bis/declared-as-template\`)
          .rule(() => [{ findings: [{ title: 'rfc-6265bis/declared-as-template' }] }])
          .done();
      `,
      errors: [{ messageId: 'repeatedName', type: 'Literal' }],
    },
  ],
});
