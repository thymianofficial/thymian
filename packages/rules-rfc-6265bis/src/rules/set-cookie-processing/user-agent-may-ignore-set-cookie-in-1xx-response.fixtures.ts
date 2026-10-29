import { apiDescription, setCookieHeader } from '../../test/builders.js';
import type { RuleFixtures } from '../../test/harness.js';
import rule from './user-agent-may-ignore-set-cookie-in-1xx-response.rule.js';

// Presence on a status code is a header name, so no value need be pinned.
// The conforming description declares Set-Cookie on a final response, and
// a 1xx response without one.
export default {
  rule,
  static: {
    violates: {
      format: apiDescription({
        response: { statusCode: 103, headers: setCookieHeader() },
      }),
    },
    conforms: {
      format: apiDescription(
        { response: { headers: setCookieHeader() } },
        { request: { path: '/early-hints' }, response: { statusCode: 103 } },
      ),
    },
  },
} satisfies RuleFixtures;
