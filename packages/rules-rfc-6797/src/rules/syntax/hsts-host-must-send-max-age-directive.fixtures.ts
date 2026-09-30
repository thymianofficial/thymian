import { stsValueFixtures } from '../../test/builders.js';
import rule from './hsts-host-must-send-max-age-directive.rule.js';

export default stsValueFixtures(rule, {
  violates: 'includeSubDomains',
  conforms: 'max-age=31536000',
});
