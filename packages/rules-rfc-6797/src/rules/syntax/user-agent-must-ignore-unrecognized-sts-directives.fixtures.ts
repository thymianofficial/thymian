import { stsValueFixtures } from '../../test/builders.js';
import rule from './user-agent-must-ignore-unrecognized-sts-directives.rule.js';

export default stsValueFixtures(rule, {
  violates: 'max-age=31536000; includeSubDomain',
  conforms: 'max-age=31536000; includeSubDomains; preload',
});
