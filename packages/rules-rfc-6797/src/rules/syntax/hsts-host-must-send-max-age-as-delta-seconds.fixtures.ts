import { stsValueFixtures } from '../../test/builders.js';
import rule from './hsts-host-must-send-max-age-as-delta-seconds.rule.js';

export default stsValueFixtures(rule, {
  violates: 'max-age=1y',
  // Quoted is fine: the syntax applies after quoted-string unescaping.
  conforms: 'max-age="31536000"',
});
