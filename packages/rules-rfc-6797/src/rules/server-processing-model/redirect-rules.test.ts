import type {
  Parameter,
  ThymianHttpRequest,
  ThymianHttpResponse,
} from '@thymian/core';
import {
  addTransaction,
  createGetRequest,
  createHttpResponse,
  createOkResponse,
  createRequiredParameter,
  createStringSchema,
  createThymianFormat,
} from '@thymian/core-testing';
import { recorded, runRule } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import hstsHostShouldRedirect from './hsts-host-should-redirect-insecure-requests-to-https.rule.js';
import serverShouldRedirect from './server-should-redirect-insecure-requests-to-https.rule.js';

// §7.2 asks for a permanent redirect whose Location, resolved against the
// request URI, is an https URI. The RFC's rule and its convention twin, which
// drops the RFC's condition and ships `off`, judge that alike in every
// context.
const redirectRules = [
  { rule: hstsHostShouldRedirect, severity: 'warn' },
  { rule: serverShouldRedirect, severity: 'off' },
] as const;

type Origin = Pick<ThymianHttpRequest, 'protocol' | 'host' | 'port'>;

const SECURE: Origin = {
  protocol: 'https',
  host: 'api.example.com',
  port: 443,
};
const INSECURE: Origin = {
  protocol: 'http',
  host: 'api.example.com',
  port: 80,
};
// What a document with no usable `servers` entry loads as: the scheme is
// Thymian's fallback, not the API's.
const FALLBACK: Origin = { protocol: 'http', host: 'localhost', port: 8080 };

const TO_HTTPS = 'https://api.example.com/';

// A declared Location header. A value pins it as the schema's `const`;
// without one the header is declared but unpinned.
function locationHeader(value?: string): Record<string, Parameter> {
  return {
    location: createRequiredParameter({
      schema: createStringSchema(value === undefined ? {} : { const: value }),
    }),
  };
}

// A declared redirect, to the pinned target when one is given.
function redirect(statusCode: number, target?: string): ThymianHttpResponse {
  return createHttpResponse({
    statusCode,
    headers: target === undefined ? {} : locationHeader(target),
  });
}

describe.each(redirectRules)('$rule.meta.name', ({ rule, severity }) => {
  const run = runRule(rule);

  // One API description for every context: content served over plain http,
  // a permanent redirect to https, an operation over https, and content on
  // the server URL fallback.
  function describedApi() {
    const format = createThymianFormat();
    const contentOverHttp = addTransaction(
      format,
      createGetRequest({ ...INSECURE, path: '/launches' }),
      createOkResponse(),
    );
    const redirectedToHttps = addTransaction(
      format,
      createGetRequest(INSECURE),
      redirect(308, TO_HTTPS),
    );
    const overHttps = addTransaction(
      format,
      createGetRequest(SECURE),
      createOkResponse(),
    );
    const onFallback = addTransaction(
      format,
      createGetRequest(FALLBACK),
      createOkResponse(),
    );

    return {
      format,
      contentOverHttp,
      redirectedToHttps,
      overHttps,
      onFallback,
    };
  }

  // A declared http://api.example.com is judged; on http://localhost:8080 the
  // scheme may be Thymian's rather than the API's, so the rule skips it. The
  // request `test` sends carries the described origin, so the same holds there.
  it.each([
    ['static', 'declares a 200, not a redirect'],
    ['test', 'was answered with 200, not a redirect'],
  ] as const)(
    'flags, in %s, content over plain http and skips the server URL fallback',
    async (context, message) => {
      const {
        format,
        contentOverHttp,
        redirectedToHttps,
        overHttps,
        onFallback,
      } = describedApi();

      expect(await run[context](format)).toMatchObject([
        {
          location: { elementId: contentOverHttp },
          status: 'failed',
          severity,
          message: expect.stringContaining(message),
        },
        { location: { elementId: redirectedToHttps }, status: 'passed' },
        { location: { elementId: overHttps }, status: 'notApplicable' },
        {
          location: { elementId: onFallback },
          status: 'skipped',
          reason: expect.stringContaining('http://localhost:8080'),
        },
      ]);
    },
  );

  // Recorded traffic is real: http://localhost:8080 is judged like any other
  // origin, never skipped.
  it('flags, in analytics, content over plain http, the server URL fallback included', async () => {
    const {
      format,
      contentOverHttp,
      redirectedToHttps,
      overHttps,
      onFallback,
    } = describedApi();
    const failed = {
      status: 'failed',
      severity,
      message: expect.stringContaining('was answered with 200, not a redirect'),
    };

    expect(await run.analytics(format)).toMatchObject([
      { location: { elementId: contentOverHttp }, ...failed },
      { location: { elementId: redirectedToHttps }, status: 'passed' },
      { location: { elementId: overHttps }, status: 'notApplicable' },
      { location: { elementId: onFallback }, ...failed },
    ]);
  });

  // The redirect is a status the API description does not declare for the
  // operation. The tester skips such an answer before a rule sees it, unless
  // the rule opts out of the status-code check, as this one does: without the
  // opt-out the 302 here would be `skipped` and not `failed`.
  it('judges, in test, a redirect the server answers with although the API description declares content', async () => {
    const format = createThymianFormat();
    const temporarilyRedirected = addTransaction(
      format,
      createGetRequest({ ...INSECURE, path: '/launches' }),
      createOkResponse(),
    );
    const permanentlyRedirected = addTransaction(
      format,
      createGetRequest({ ...INSECURE, path: '/astronauts' }),
      createOkResponse(),
    );
    const overHttps = addTransaction(
      format,
      createGetRequest(SECURE),
      createOkResponse(),
    );

    const executions = await run.test(format, {
      respond: ({ transaction, conforming }) => ({
        ...conforming,
        statusCode: transaction === temporarilyRedirected ? 302 : 301,
        headers: { location: TO_HTTPS },
      }),
    });

    expect(executions).toMatchObject([
      {
        location: { elementId: temporarilyRedirected },
        status: 'failed',
        severity,
        message: expect.stringContaining(
          'was answered with 302, a redirect that is not permanent',
        ),
      },
      { location: { elementId: permanentlyRedirected }, status: 'passed' },
      { location: { elementId: overHttps }, status: 'notApplicable' },
    ]);
  });

  // Each way of missing the redirect §7.2 asks for is its own finding, and
  // the violation says which.
  describe.each([
    [
      'a redirect that is not permanent',
      redirect(302, TO_HTTPS),
      '302, a redirect that is not permanent',
    ],
    [
      'a missing Location',
      redirect(301),
      '301 without a Location header field',
    ],
    [
      'a target that is not https',
      redirect(308, 'http://api.example.com/'),
      '"http://api.example.com/", which is not an https URI',
    ],
    // Resolved against the plain-http request, a relative reference stays on
    // plain http.
    [
      'a relative target',
      redirect(301, '/elsewhere'),
      '"/elsewhere", which is not an https URI',
    ],
  ])('for %s', (_reason, response, message) => {
    it.each(['static', 'test', 'analytics'] as const)(
      'names the reason in %s',
      async (context) => {
        const format = createThymianFormat();
        const answered = addTransaction(
          format,
          createGetRequest(INSECURE),
          response,
        );

        expect(await run[context](format)).toMatchObject([
          {
            location: { elementId: answered },
            status: 'failed',
            message: expect.stringContaining(message),
          },
        ]);
      },
    );
  });

  // A response may carry Location more than once, and each field line is a
  // target the user agent may follow, so every one must be https.
  describe('for a second Location that is not https', () => {
    const headers = { location: [TO_HTTPS, 'http://api.example.com/'] };
    const expected = {
      status: 'failed',
      message: expect.stringContaining(
        'redirected to "http://api.example.com/", which is not an https URI',
      ),
    };

    it('names the reason in test', async () => {
      const format = createThymianFormat();
      const redirected = addTransaction(
        format,
        createGetRequest(INSECURE),
        redirect(301, TO_HTTPS),
      );

      const executions = await run.test(format, {
        respond: ({ conforming }) => ({ ...conforming, headers }),
      });

      expect(executions).toMatchObject([
        { location: { elementId: redirected }, ...expected },
      ]);
    });

    it('names the reason in analytics', async () => {
      const format = createThymianFormat();
      const redirected = addTransaction(
        format,
        createGetRequest(INSECURE),
        redirect(301, TO_HTTPS),
      );

      const executions = await run.analytics(format, {
        traffic: [recorded(format, redirected, { response: { headers } })],
      });

      expect(executions).toMatchObject([
        { location: { elementId: redirected }, ...expected },
      ]);
    });
  });

  // Every request over plain http is owed the redirect, so `static` judges
  // each declared response on its own, as `test` and `analytics` judge each
  // answer: a permanent redirect beside it does not excuse the other.
  it.each([
    ['content', 200, 'declares a 200, not a redirect'],
    [
      'a redirect that is not permanent',
      302,
      'declares a 302, a redirect that is not permanent',
    ],
  ])(
    'flags, in static, %s declared beside a permanent redirect',
    async (_what, statusCode, message) => {
      const format = createThymianFormat();
      const request = createGetRequest(INSECURE);
      const permanentRedirect = addTransaction(
        format,
        request,
        redirect(301, TO_HTTPS),
      );
      const other = addTransaction(format, request, redirect(statusCode));

      expect(await run.static(format)).toMatchObject([
        { location: { elementId: permanentRedirect }, status: 'passed' },
        {
          location: { elementId: other },
          status: 'failed',
          message: expect.stringContaining(message),
        },
      ]);
    },
  );

  it('skips, in static, a Location the API description declares without pinning', async () => {
    const format = createThymianFormat();
    const unpinned = addTransaction(
      format,
      createGetRequest(INSECURE),
      createHttpResponse({ statusCode: 301, headers: locationHeader() }),
    );

    expect(await run.static(format)).toMatchObject([
      {
        location: { elementId: unpinned },
        status: 'skipped',
        reason: expect.stringContaining('does not pin its value'),
      },
    ]);
  });
});
