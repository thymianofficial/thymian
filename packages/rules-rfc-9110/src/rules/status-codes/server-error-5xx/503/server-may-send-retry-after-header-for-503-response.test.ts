import {
  addTransaction,
  createGetRequest,
  createHttpResponse,
  createOkResponse,
  createOptionalParameter,
  createRequiredParameter,
  createThymianFormat,
} from '@thymian/core-testing';
import { createRuleTester } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import rule from './server-may-send-retry-after-header-for-503-response.rule.js';

// The method of a rule tester that runs a rule in a validation context.
const METHOD = {
  static: 'runLint',
  analytics: 'runAnalyze',
} as const;

const retryAfterInUse = {
  status: 'passed',
  findings: [
    {
      kind: 'informational',
      message: {
        text: 'The 503 (Service Unavailable) response carries a Retry-After header field suggesting when the client may retry.',
      },
    },
  ],
};

describe(rule.meta.name, () => {
  const ruleTester = createRuleTester(rule);

  // Retry-After is asked for by name only, which every context sees the
  // same way: documented in `static`, recorded in `analytics`.
  it.each(['static', 'analytics'] as const)(
    'reports, in %s, the 503 responses that carry Retry-After',
    async (context) => {
      const format = createThymianFormat();
      const required = addTransaction(
        format,
        createGetRequest({ path: '/launches' }),
        createHttpResponse({
          statusCode: 503,
          headers: { 'Retry-After': createRequiredParameter() },
        }),
      );
      const optional = addTransaction(
        format,
        createGetRequest({ path: '/astronauts' }),
        createHttpResponse({
          statusCode: 503,
          headers: { 'Retry-After': createOptionalParameter() },
        }),
      );
      const without = addTransaction(
        format,
        createGetRequest({ path: '/rockets' }),
        createHttpResponse({ statusCode: 503 }),
      );
      const notA503 = addTransaction(
        format,
        createGetRequest({ path: '/missions' }),
        createOkResponse({
          headers: { 'Retry-After': createRequiredParameter() },
        }),
      );

      expect(await ruleTester[METHOD[context]](format)).toMatchObject([
        { location: { elementId: required }, ...retryAfterInUse },
        { location: { elementId: optional }, ...retryAfterInUse },
        { location: { elementId: without }, status: 'passed', findings: [] },
        { location: { elementId: notA503 }, status: 'notApplicable' },
      ]);
    },
  );
});
