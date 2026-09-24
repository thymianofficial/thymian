import { stsValueFixtures } from '../../test/builders.js';
import rule from './hsts-host-must-send-sts-header-conforming-to-grammar.rule.js';

export default stsValueFixtures(rule, {
  violates: 'max-age=31536000, includeSubDomains',
  conforms: 'max-age=31536000; includeSubDomains',
});
