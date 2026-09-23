import {
  apiDescription,
  recorded,
  respondWith,
  STS_ONE_YEAR,
  stsHeader,
} from '../../test/builders.js';
import { defineFixtures } from '../../test/harness.js';
import rule from './server-should-send-sts-header-over-secure-transport.rule.js';

export default defineFixtures({
  rule,
  static: {
    violates: { format: apiDescription({}) },
    conforms: {
      format: apiDescription({ response: { headers: stsHeader() } }),
    },
  },
  test: {
    violates: { format: apiDescription({}), respond: respondWith({}) },
    conforms: {
      format: apiDescription({}),
      respond: respondWith({ headers: STS_ONE_YEAR }),
    },
  },
  analytics: {
    violates: { transactions: [recorded({})] },
    conforms: { transactions: [recorded({ headers: STS_ONE_YEAR })] },
  },
});
