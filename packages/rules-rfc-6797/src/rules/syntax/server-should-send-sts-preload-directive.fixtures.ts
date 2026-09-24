import { stsValueFixtures } from '../../test/builders.js';
import rule from './server-should-send-sts-preload-directive.rule.js';

export default stsValueFixtures(rule, {
  violates: 'max-age=31536000; includeSubDomains',
  conforms: 'max-age=31536000; includeSubDomains; preload',
});
