import {
  apiDescription,
  recorded,
  respondWith,
  STS_ONE_YEAR,
} from '../../test/builders.js';
import { defineFixtures } from '../../test/harness.js';
import rule from './hsts-host-must-send-only-one-sts-header.rule.js';

// Repeated field lines of one name arrive as an array, from the dispatcher in
// `test` and from the recorded traffic in `analytics`.
const twice = {
  'strict-transport-security': ['max-age=31536000', 'max-age=0'],
};

export default defineFixtures({
  rule,
  test: {
    violates: {
      format: apiDescription({}),
      respond: respondWith({ headers: twice }),
    },
    conforms: {
      format: apiDescription({}),
      respond: respondWith({ headers: STS_ONE_YEAR }),
    },
  },
  analytics: {
    violates: { transactions: [recorded({ headers: twice })] },
    conforms: { transactions: [recorded({ headers: STS_ONE_YEAR })] },
  },
});
