import type { ThymianHttpRequest } from '@thymian/core';
import {
  addTransaction,
  createGetRequest,
  createOkResponse,
  createRequiredParameter,
  createThymianFormat,
} from '@thymian/core-testing';
import { runRule } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import { STS_HEADER } from '../utils/sts-field-value.js';
import rule from './hsts-host-must-not-send-sts-header-over-insecure-transport.rule.js';

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

const stsHeader = { [STS_HEADER]: createRequiredParameter() };

const MESSAGE =
  'This response over non-secure transport (http) carries a Strict-Transport-Security header field. An HSTS Host MUST NOT include it in responses conveyed over non-secure transport.';

describe(rule.meta.name, () => {
  const run = runRule(rule);

  // One API description for every context: the header declared over plain
  // http, over https, not at all, and on the server URL fallback.
  function describedApi() {
    const format = createThymianFormat();
    const overHttp = addTransaction(
      format,
      createGetRequest(INSECURE),
      createOkResponse({ headers: stsHeader }),
    );
    const overHttps = addTransaction(
      format,
      createGetRequest(SECURE),
      createOkResponse({ headers: stsHeader }),
    );
    const overHttpWithoutHeader = addTransaction(
      format,
      createGetRequest({ ...INSECURE, path: '/launches' }),
      createOkResponse(),
    );
    const onFallback = addTransaction(
      format,
      createGetRequest(FALLBACK),
      createOkResponse({ headers: stsHeader }),
    );

    return { format, overHttp, overHttps, overHttpWithoutHeader, onFallback };
  }

  // A declared http://api.example.com is judged; on http://localhost:8080 the
  // scheme may be Thymian's rather than the API's, so the rule skips it. The
  // request `test` sends carries the described origin, so the same holds there.
  it.each(['static', 'test'] as const)(
    'flags, in %s, the header over plain http and skips the server URL fallback',
    async (context) => {
      const { format, overHttp, overHttps, overHttpWithoutHeader, onFallback } =
        describedApi();

      expect(await run[context](format)).toMatchObject([
        {
          location: { elementId: overHttp },
          status: 'failed',
          severity: 'error',
          message: MESSAGE,
        },
        { location: { elementId: overHttps }, status: 'notApplicable' },
        { location: { elementId: overHttpWithoutHeader }, status: 'passed' },
        {
          location: { elementId: onFallback },
          status: 'skipped',
          reason: expect.stringContaining('http://localhost:8080'),
        },
      ]);
    },
  );

  it('flags, in test, a header the server sends over plain http although none is declared', async () => {
    const format = createThymianFormat();
    const overHttp = addTransaction(
      format,
      createGetRequest(INSECURE),
      createOkResponse(),
    );
    const overHttps = addTransaction(
      format,
      createGetRequest(SECURE),
      createOkResponse(),
    );

    const executions = await run.test(format, {
      respond: ({ conforming }) => ({
        ...conforming,
        headers: { ...conforming.headers, [STS_HEADER]: 'max-age=31536000' },
      }),
    });

    expect(executions).toMatchObject([
      { location: { elementId: overHttp }, status: 'failed', message: MESSAGE },
      { location: { elementId: overHttps }, status: 'notApplicable' },
    ]);
  });

  // Recorded traffic is real: http://localhost:8080 is judged like any other
  // origin, never skipped.
  it('flags, in analytics, the header over plain http, the server URL fallback included', async () => {
    const { format, overHttp, overHttps, overHttpWithoutHeader, onFallback } =
      describedApi();

    expect(await run.analytics(format)).toMatchObject([
      {
        location: { elementId: overHttp },
        status: 'failed',
        severity: 'error',
        message: MESSAGE,
      },
      { location: { elementId: overHttps }, status: 'notApplicable' },
      { location: { elementId: overHttpWithoutHeader }, status: 'passed' },
      {
        location: { elementId: onFallback },
        status: 'failed',
        message: MESSAGE,
      },
    ]);
  });
});
