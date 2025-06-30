import type { RuleSet } from '@thymian/http-linter';

const rfc9110: RuleSet = {
  name: 'rfc9110',
  url: 'https://datatracker.ietf.org/doc/html/rfc9110',
  pattern: 'rules/**/*.rule.js',
};

export default rfc9110;
