import {
  apiDescription,
  INSECURE,
  recorded,
  respondByScheme,
  respondWith,
  STS_ONE_YEAR,
  stsHeader,
} from '../../test/builders.js';
import type { RuleFixtures } from '../../test/harness.js';
import rule from './server-should-send-sts-header-over-secure-transport.rule.js';

// Each conforming input also holds a plain-http response without the
// header: only a response over secure transport is asked for one.
export default {
  rule,
  static: {
    violates: { format: apiDescription({}) },
    conforms: {
      format: apiDescription(
        { response: { headers: stsHeader() } },
        { request: INSECURE },
      ),
    },
  },
  test: {
    violates: { format: apiDescription({}), respond: respondWith({}) },
    conforms: {
      format: apiDescription({}, { request: INSECURE }),
      respond: respondByScheme({ https: { headers: STS_ONE_YEAR }, http: {} }),
    },
  },
  analytics: {
    violates: { transactions: [recorded({})] },
    conforms: {
      transactions: [
        recorded({ headers: STS_ONE_YEAR }),
        recorded({ origin: INSECURE }),
      ],
    },
  },
} satisfies RuleFixtures;
