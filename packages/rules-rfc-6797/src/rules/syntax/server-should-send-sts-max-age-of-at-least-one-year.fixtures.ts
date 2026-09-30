import { stsValueFixtures } from '../../test/builders.js';
import rule from './server-should-send-sts-max-age-of-at-least-one-year.rule.js';

export default stsValueFixtures(rule, {
  violates: 'max-age=86400',
  conforms: 'max-age=31536000',
});
