import { stsValueFixtures } from '../../test/builders.js';
import rule from './hsts-host-must-not-repeat-sts-directives.rule.js';

export default stsValueFixtures(rule, {
  // Directive names are case-insensitive (§6.1 item 3).
  violates: 'max-age=31536000; Max-Age=60',
  conforms: 'max-age=31536000; includeSubDomains',
});
