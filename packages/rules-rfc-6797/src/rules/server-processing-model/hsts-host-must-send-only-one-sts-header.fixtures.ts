import {
  apiDescription,
  recorded,
  respondWith,
  STS_ONE_YEAR,
} from '../../test/builders.js';
import type { RuleFixtures } from '../../test/harness.js';
import { STS_HEADER } from '../utils/sts-field-value.js';
import rule from './hsts-host-must-send-only-one-sts-header.rule.js';

// Two field lines of one name arrive as an array, from the dispatcher in
// `test` and from the recorded traffic in `analytics`. Each line on its own
// is a valid policy: the defect is that there are two.
const twice = { [STS_HEADER]: ['max-age=31536000', 'max-age=0'] };

export default {
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
} satisfies RuleFixtures;
