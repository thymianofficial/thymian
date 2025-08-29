import type { HttpRequest, HttpResponse } from '@thymian/core';
import {
  and,
  type HttpFilterExpression,
  method,
  or,
  statusCode,
} from '@thymian/http-filter';
import { beforeEach, describe, expect, it } from 'vitest';

import { HttpTransactionRepository } from '../src/db/initialize.js';

function makeRequest(i: number): HttpRequest {
  const methods = ['GET', 'POST', 'HEAD'];
  const origins = ['http://a.com', 'http://b.com'];
  const paths = ['/users', '/orders', '/status'];
  const m = methods[i % methods.length];
  const o = origins[i % origins.length];
  const p = paths[i % paths.length];

  return {
    method: m,
    origin: o,
    path: `${p}/${i}`,
    headers: {
      'x-seq': String(i),
      'content-type': i % 2 === 0 ? 'application/json' : 'text/plain',
    },
  };
}

function makeResponse(i: number): HttpResponse {
  const codes = [200, 201, 204, 400, 404, 500];
  const code = codes[i % codes.length];
  return {
    statusCode: code,
    headers: {
      'content-type':
        code >= 400
          ? 'application/problem+json'
          : 'application/json; charset=utf-8',
    },
    trailers: {
      'x-trailer': `t-${i}`,
    },
    duration: (i % 10) + 1,
    body: i % 3 === 0 ? `{"ok":${i}}` : undefined,
    bodyEncoding: i % 3 === 0 ? 'utf-8' : undefined,
  };
}

async function seed(
  repo: HttpTransactionRepository,
  count = 20
): Promise<void> {
  await repo.init();
  for (let i = 0; i < count; i++) {
    repo.createHttpTransaction(makeRequest(i), makeResponse(i));
  }
}

describe('HttpTransactionRepository.listTransactionsByFilter', () => {
  let repo: HttpTransactionRepository;

  beforeEach(async () => {
    repo = new HttpTransactionRepository(':memory:');
    await seed(repo, 20);
  });

  const run = (
    filter?: HttpFilterExpression,
    limit?: number,
    offset?: number
  ) => repo.listTransactionsByFilter(filter, limit, offset);

  it('returns all transactions when no filter is provided', () => {
    const rows = run(undefined);
    expect(rows.length).toBe(20);
  });

  it('filters by method (GET)', () => {
    const rows = run(method('GET'));
    // With methods cycling GET, POST, HEAD => 20 records => approx 7 GET (indexes 0,3,6,9,12,15,18)
    const expectedGet = 7;
    expect(rows.length).toBe(expectedGet);
    expect(rows.every((r) => r.request.method.toUpperCase() === 'GET')).toBe(
      true
    );
  });

  it('filters by status code (200)', () => {
    const rows = run(statusCode(200));
    // Codes cycle [200,201,204,400,404,500] => every 6, within 20 => indices 0,6,12,18 => 4
    expect(rows.length).toBe(4);
    expect(rows.every((r) => r.response.statusCode === 200)).toBe(true);
  });

  it('combines filters with and/or', () => {
    const filter = and(or(method('get'), method('head')), statusCode(200));
    const rows = run(filter);
    // method GET or HEAD and status 200
    // From seeding: method cycles every 3, status every 6. 200 appears at i = 0,6,12,18; methods at those:
    // i=0 -> GET, i=6 -> GET, i=12 -> GET, i=18 -> GET => all 4 match (HEAD never coincides with 200 in this cycle)
    expect(rows.length).toBe(4);
    expect(
      rows.every((r) =>
        ['GET', 'HEAD'].includes(r.request.method.toUpperCase())
      )
    ).toBe(true);
    expect(rows.every((r) => r.response.statusCode === 200)).toBe(true);
  });

  it('responseWith', () => {
    const filter = and(or(method('get'), method('head')), statusCode(200));
    const rows = run(filter);
    // method GET or HEAD and status 200
    // From seeding: method cycles every 3, status every 6. 200 appears at i = 0,6,12,18; methods at those:
    // i=0 -> GET, i=6 -> GET, i=12 -> GET, i=18 -> GET => all 4 match (HEAD never coincides with 200 in this cycle)
    expect(rows.length).toBe(4);
    expect(
      rows.every((r) =>
        ['GET', 'HEAD'].includes(r.request.method.toUpperCase())
      )
    ).toBe(true);
    expect(rows.every((r) => r.response.statusCode === 200)).toBe(true);
  });

  it('supports pagination (limit and offset) without overlaps', () => {
    const first = run(undefined, 5, 0);
    const second = run(undefined, 5, 5);

    expect(first.length).toBe(5);
    expect(second.length).toBe(5);

    const firstIds = new Set(first.map((r) => r.id));
    const overlap = second.some((r) => firstIds.has(r.id));
    expect(overlap).toBe(false);
  });
});
