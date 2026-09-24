import { stsValueFixtures } from '../../test/builders.js';
import rule from './hsts-host-may-assert-include-subdomains.rule.js';

export default stsValueFixtures(rule, {
  violates: 'max-age=31536000',
  conforms: 'max-age=31536000; includeSubDomains',
});
