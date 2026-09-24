import { stsValueFixtures } from '../../test/builders.js';
import rule from './hsts-host-must-send-include-subdomains-without-value.rule.js';

export default stsValueFixtures(rule, {
  violates: 'max-age=31536000; includeSubDomains=true',
  conforms: 'max-age=31536000; includeSubDomains',
});
