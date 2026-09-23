import { stsValueFixtures } from '../../test/builders.js';
import rule from './hsts-host-must-not-repeat-sts-directives.rule.js';

export default stsValueFixtures(rule, {
  violates: 'max-age=31536000; Max-Age=60',
  conforms: 'max-age=31536000; includeSubDomains',
});
