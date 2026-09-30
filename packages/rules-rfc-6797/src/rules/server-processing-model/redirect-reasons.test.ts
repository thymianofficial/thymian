import type { HttpResponse, RuleFnResult } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import {
  apiDescription,
  header,
  INSECURE,
  recorded,
  respondWith,
} from '../../test/builders.js';
import {
  type CaseOf,
  fixtureContexts,
  runInContext,
} from '../../test/harness.js';
import rfcRule from './hsts-host-should-redirect-insecure-requests-to-https.rule.js';
import conventionRule from './server-should-redirect-insecure-requests-to-https.rule.js';

// §7.2 asks for a permanent redirect whose Location, resolved against the
// request URI, is an https URI. Each way of missing that is its own finding,
// and the violation says which — in every context, for the RFC rule and for
// its convention twin alike.

// One plain-http request answered with `statusCode` and, if given, a
// Location: declared in `static`, answered in `test`, recorded in
// `analytics`.
function answeredWith(statusCode: number, location?: string): CaseOf {
  const headers: HttpResponse['headers'] =
    location === undefined ? {} : { location };

  return {
    static: {
      format: apiDescription({
        request: INSECURE,
        response: {
          statusCode,
          headers: location === undefined ? {} : header('location', location),
        },
      }),
    },
    test: {
      format: apiDescription({ request: INSECURE }),
      respond: respondWith({ statusCode, headers }),
    },
    analytics: {
      transactions: [recorded({ origin: INSECURE, statusCode, headers })],
    },
  };
}

const reasons: [string, CaseOf, RegExp][] = [
  [
    'a redirect that is not permanent',
    answeredWith(302, 'https://api.example.com/'),
    /302, a redirect that is not permanent/,
  ],
  ['a missing Location', answeredWith(301), /without a Location|no Location/],
  [
    'a target that is not https',
    answeredWith(308, 'http://api.example.com/'),
    /"http:\/\/api\.example\.com\/", which is not an https URI/,
  ],
  // Resolved against the plain-http request, a relative reference stays on
  // plain http.
  [
    'a relative target',
    answeredWith(301, '/elsewhere'),
    /"\/elsewhere", which is not an https URI/,
  ],
];

const messages = (results: RuleFnResult[]) =>
  results.flatMap((result) =>
    result.violation === undefined ? [] : [result.violation.message],
  );

describe.each([rfcRule, conventionRule])('$meta.name', (rule) => {
  describe.each(fixtureContexts)('in %s', (context) => {
    it.each(reasons)('names %s', async (_reason, inputs, expected) => {
      const results = await runInContext(context, rule, inputs[context]);

      expect(messages(results)).toEqual([expect.stringMatching(expected)]);
    });
  });

  it('skips, in static, a Location the description declares without pinning', async () => {
    const results = await runInContext('static', rule, {
      format: apiDescription({
        request: INSECURE,
        response: { statusCode: 301, headers: header('location') },
      }),
    });

    expect(messages(results)).toEqual([]);
    expect(results.flatMap((result) => result.findings)).toEqual([
      expect.objectContaining({ kind: 'rule-skip', title: rule.meta.name }),
    ]);
  });
});
