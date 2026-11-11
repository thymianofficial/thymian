import type { RuleFnResult } from '@thymian/core';
import {
  type ObservedInput,
  runInContext,
  validationContexts,
} from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import {
  apiDescription,
  header,
  INSECURE,
  observedResponse,
} from '../../test/builders.js';
import rfcRule from './hsts-host-should-redirect-insecure-requests-to-https.rule.js';
import conventionRule from './server-should-redirect-insecure-requests-to-https.rule.js';

// §7.2 asks for a permanent redirect whose Location, resolved against the
// request URI, is an https URI. Each way of missing that is its own finding,
// and the violation says which — in every context, for the RFC rule and for
// its convention twin alike.

// One plain-http request answered with `statusCode` and, if given, a
// Location: declared in `static`, answered in `test`, recorded in
// `analytics`.
function answeredWith(statusCode: number, location?: string): ObservedInput {
  return observedResponse({
    origin: INSECURE,
    statusCode,
    declared: location === undefined ? {} : header('location', location),
    sent: location === undefined ? {} : { location },
  });
}

const reasons: [string, ObservedInput, RegExp][] = [
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
  describe.each(validationContexts)('in %s', (context) => {
    it.each(reasons)('names %s', async (_reason, input, expected) => {
      const results = await runInContext(context, rule, input);

      expect(messages(results)).toEqual([expect.stringMatching(expected)]);
    });
  });

  // A response may carry Location more than once, and each field line is a
  // target the user agent may follow, so every one must be https.
  it.each(['test', 'analytics'] as const)(
    'names, in %s, a second Location that is not https',
    async (context) => {
      const results = await runInContext(
        context,
        rule,
        observedResponse({
          origin: INSECURE,
          statusCode: 301,
          sent: {
            location: ['https://api.example.com/', 'http://api.example.com/'],
          },
        }),
      );

      expect(messages(results)).toEqual([
        expect.stringMatching(
          /redirected to "http:\/\/api\.example\.com\/", which is not an https URI/,
        ),
      ]);
    },
  );

  // Every request over plain http is owed the redirect, so `static` judges
  // each declared response on its own, as `test` and `analytics` judge each
  // answer: a permanent redirect beside it does not excuse the other.
  it.each([
    ['content', 200, /declares a 200, not a redirect/],
    [
      'a redirect that is not permanent',
      302,
      /declares a 302, a redirect that is not permanent/,
    ],
  ])(
    'flags, in static, %s declared beside a permanent redirect',
    async (_what, statusCode, expected) => {
      const results = await runInContext('static', rule, {
        format: apiDescription(
          {
            request: INSECURE,
            response: {
              statusCode: 301,
              headers: header('location', 'https://api.example.com/'),
            },
          },
          { request: INSECURE, response: { statusCode } },
        ),
      });

      expect(messages(results)).toEqual([expect.stringMatching(expected)]);
    },
  );

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
