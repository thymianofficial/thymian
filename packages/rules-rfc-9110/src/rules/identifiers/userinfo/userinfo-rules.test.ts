import type {
  AnalyzeContext,
  CommonHttpRequest,
  CommonHttpResponse,
  HttpRequest,
  HttpResponse,
  RuleFnResult,
  RuleViolationLocation,
} from '@thymian/core';
import { NoopLogger } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import recipientRule from './recipient-should-treat-userinfo-in-uri-from-untrusted-source-as-error.rule';
import senderRule from './sender-must-not-generate-userinfo-in-uri.rule';

const logger = new NoopLogger();
const options = { mode: 'analytics' as const };

const okResponse: HttpResponse = {
  statusCode: 200,
  headers: {},
  trailers: {},
  duration: 0,
};

// The analyze rules only reach validateHttpTransactions /
// validateCommonHttpTransactions and run the supplied fn against each
// transaction, so feeding a single crafted transaction isolates the rule's own
// predicate — in particular whether it reads userinfo from `target`.
function httpContext(req: HttpRequest, res: HttpResponse): AnalyzeContext {
  return {
    validateHttpTransactions: (
      _filter: unknown,
      fn: (
        req: HttpRequest,
        res: HttpResponse,
        location: RuleViolationLocation,
      ) => RuleFnResult[],
    ) => fn(req, res, 'test-location'),
  } as unknown as AnalyzeContext;
}

function commonContext(req: CommonHttpRequest): AnalyzeContext {
  const res: CommonHttpResponse = {
    statusCode: 200,
    mediaType: '',
    headers: [],
    body: false,
    trailers: [],
  };
  return {
    validateCommonHttpTransactions: (
      _filter: unknown,
      fn: (
        req: CommonHttpRequest,
        res: CommonHttpResponse,
        location: RuleViolationLocation,
      ) => RuleFnResult[],
    ) => fn(req, res, 'test-location'),
  } as unknown as AnalyzeContext;
}

function httpRequest(overrides: Partial<HttpRequest>): HttpRequest {
  return {
    method: 'get',
    origin: 'https://api.example.com',
    path: '/users',
    headers: {},
    ...overrides,
  };
}

function commonRequest(
  overrides: Partial<CommonHttpRequest>,
): CommonHttpRequest {
  return {
    method: 'get',
    origin: 'https://api.example.com',
    path: '/users',
    headers: [],
    queryParameters: [],
    cookies: [],
    mediaType: '',
    body: false,
    ...overrides,
  };
}

describe('recipient-should-treat-userinfo-in-uri-from-untrusted-source-as-error', () => {
  it('flags userinfo in the target URI when the recipient did not reject it', async () => {
    const ctx = httpContext(
      httpRequest({ target: 'https://user:pass@api.example.com/users' }),
      okResponse,
    );

    const result = await recipientRule.analyzeRule!(ctx, options, logger);

    expect(result).toHaveLength(1);
  });

  it('does not flag when the recipient rejected it with a 4xx', async () => {
    const ctx = httpContext(
      httpRequest({ target: 'https://user:pass@api.example.com/users' }),
      { ...okResponse, statusCode: 403 },
    );

    const result = await recipientRule.analyzeRule!(ctx, options, logger);

    expect(result).toHaveLength(0);
  });

  it('does not flag a target URI without userinfo', async () => {
    const ctx = httpContext(
      httpRequest({ target: 'https://api.example.com/users' }),
      okResponse,
    );

    const result = await recipientRule.analyzeRule!(ctx, options, logger);

    expect(result).toHaveLength(0);
  });
});

describe('sender-must-not-generate-userinfo-in-uri', () => {
  it('flags userinfo in the target URI', async () => {
    const ctx = commonContext(
      commonRequest({ target: 'https://user:pass@api.example.com/users' }),
    );

    const result = await senderRule.analyzeRule!(ctx, options, logger);

    expect(result).toHaveLength(1);
  });

  it('does not flag a target URI without userinfo', async () => {
    const ctx = commonContext(
      commonRequest({ target: 'https://api.example.com/users' }),
    );

    const result = await senderRule.analyzeRule!(ctx, options, logger);

    expect(result).toHaveLength(0);
  });
});
