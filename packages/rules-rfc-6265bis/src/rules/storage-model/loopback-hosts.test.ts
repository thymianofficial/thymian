import type { RuleFnResult } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { setCookieInputsAt } from '../../test/builders.js';
import { runInContext } from '../../test/harness.js';
import { isLoopbackOrigin } from '../utils/transport.js';
import nonMatchingDomainRule from './user-agent-must-ignore-cookie-with-non-matching-domain.rule.js';
import secureOverInsecureRule from './user-agent-must-ignore-secure-cookie-over-insecure-connection.rule.js';

// A description that lists a local development server beside the deployed
// API is loaded from the development server, so `static` and `test` see a
// loopback host other than Thymian's own fallback. Its host and scheme are
// not the deployed API's either, so the transport is not judged there.

const LOCAL_DEV = { protocol: 'http', host: 'localhost', port: 3000 } as const;

const kinds = (results: RuleFnResult[]) =>
  results.map((result) =>
    result.violation === undefined ? 'skip' : 'violation',
  );

describe('isLoopbackOrigin', () => {
  it.each([
    'http://localhost:8080',
    'http://localhost:3000',
    'https://api.localhost',
    'http://127.0.0.1:5000',
    'http://127.1.2.3',
    'http://[::1]:8080',
  ])('takes %s for a loopback host', (origin) => {
    expect(isLoopbackOrigin(origin)).toBe(true);
  });

  it.each([
    'https://api.example.com',
    'https://localhost.example.com',
    'http://128.0.0.1',
    'http://[::2]',
    'not a url',
  ])('does not take %s for one', (origin) => {
    expect(isLoopbackOrigin(origin)).toBe(false);
  });
});

describe('a described local development server', () => {
  it.each([
    [
      'a Domain the host does not match',
      nonMatchingDomainRule,
      'SID=31d4; Domain=example.com',
    ],
    [
      'a Secure cookie over plain http',
      secureOverInsecureRule,
      'SID=31d4; Secure',
    ],
  ])('leaves %s unjudged in static and test', async (_name, rule, line) => {
    const inputs = setCookieInputsAt(LOCAL_DEV, [line]);

    expect(kinds(await runInContext('static', rule, inputs.static))).toEqual([
      'skip',
    ]);
    expect(kinds(await runInContext('test', rule, inputs.test))).toEqual([
      'skip',
    ]);
    expect(
      kinds(await runInContext('analytics', rule, inputs.analytics)),
    ).toEqual(['violation']);
  });
});
