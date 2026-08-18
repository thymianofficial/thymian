import { join } from 'node:path';

import type {
  HttpRequest,
  HttpRequestTemplate,
  HttpResponse,
} from '@thymian/core';
import {
  createMockLogger,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { HookRunner } from '../src/hooks/hook-runner.js';

const format = createThymianFormatWithTransactions(1);

function createRunner(path: string): HookRunner {
  return new HookRunner(
    path,
    async (): Promise<HttpResponse> => {
      throw new Error('runRequest must not be called in these tests');
    },
    createMockLogger(),
  );
}

const requestTemplate: HttpRequestTemplate = {
  authorize: false,
  cookies: {},
  headers: {},
  method: 'get',
  origin: 'http://localhost',
  path: '/things',
  pathParameters: {},
  query: {},
};

const request = {
  method: 'get',
  url: 'http://localhost/things',
  headers: {},
} as unknown as HttpRequest;

const response = {
  statusCode: 200,
  headers: {},
} as unknown as HttpResponse;

describe('HookRunner without a samples tree', () => {
  const missingPath = join(
    process.cwd(),
    'this-directory-does-not-exist',
    'samples',
  );

  it('initializes as a pass-through instead of staying uninitialized', async () => {
    const runner = createRunner(missingPath);

    await expect(runner.init(format)).resolves.toBeUndefined();
  });

  it('passes a request template through beforeEachRequest unchanged', async () => {
    const runner = createRunner(missingPath);
    await runner.init(format);

    const result = await runner.beforeEachRequest({
      value: requestTemplate,
      ctx: undefined,
    });

    expect(result.result).toEqual(requestTemplate);
    expect(result.skip).toBeUndefined();
    expect(result.fail).toBeUndefined();
  });

  it('passes a response through afterEachResponse unchanged', async () => {
    const runner = createRunner(missingPath);
    await runner.init(format);

    const result = await runner.afterEachResponse({
      value: response,
      ctx: { requestTemplate, request },
    });

    expect(result.result).toEqual(response);
    expect(result.skip).toBeUndefined();
    expect(result.fail).toBeUndefined();
  });

  it('passes a request template through authorize unchanged', async () => {
    const runner = createRunner(missingPath);
    await runner.init(format);

    const result = await runner.authorize({
      value: requestTemplate,
      ctx: undefined,
    });

    expect(result.result).toEqual(requestTemplate);
    expect(result.skip).toBeUndefined();
    expect(result.fail).toBeUndefined();
  });
});
