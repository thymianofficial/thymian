import {
  and,
  authorization,
  type CapturedTransaction,
  constant,
  hasRequestBody,
  hasResponseBody,
  type HttpFilterExpression,
  matchesOrigin,
  method,
  NoopLogger,
  not,
  or,
  origin,
  path,
  port,
  protocol,
  queryParameter,
  requestHeader,
  requestMediaType,
  responseHeader,
  responseMediaType,
  responseTrailer,
  responseWith,
  statusCode,
  statusCodeRange,
  url,
  xor,
} from '@thymian/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { compileHttpFilterToWhereClause } from '../../src/db/http-filter-to-where-clause.js';
import { SqliteHttpTransactionRepository } from '../../src/db/sqlite-http-transaction-repository.js';

const A = '/items?page=1&sort=asc';
const B = '/items?page=2';
const C = '/other';

const transactionA: CapturedTransaction = {
  request: {
    data: {
      method: 'GET',
      origin: 'https://api.example.com',
      path: A,
      headers: { 'x-req': 'a', 'content-type': 'application/json' },
      body: '{}',
    },
    meta: { role: 'client' },
  },
  response: {
    data: {
      statusCode: 200,
      headers: { 'x-res': 'r', 'content-type': 'application/json' },
      trailers: { 'x-trail': 't' },
      body: 'ok',
      duration: 1,
    },
    meta: { role: 'server' },
  },
};

const transactionB: CapturedTransaction = {
  request: {
    data: { method: 'POST', origin: 'http://other.example.com', path: B },
    meta: { role: 'client' },
  },
  response: {
    data: { statusCode: 404, headers: {}, trailers: {}, duration: 1 },
    meta: { role: 'server' },
  },
};

const transactionC: CapturedTransaction = {
  request: {
    data: { method: 'GET', origin: 'https://api.example.com', path: C },
    meta: { role: 'client' },
  },
  response: {
    data: {
      statusCode: 200,
      headers: { 'content-type': 'text/plain' },
      trailers: {},
      duration: 1,
    },
    meta: { role: 'server' },
  },
};

type Case = { name: string; filter: HttpFilterExpression; matches: string[] };

// Keyed by filter type so that a new filter type without a case fails the typecheck.
const supported: {
  [
    T in Exclude<
      HttpFilterExpression['type'],
      'hasResponse' | 'isAuthorized' | 'port'
    >
  ]: Case[];
} = {
  origin: [
    {
      name: 'origin',
      filter: origin('https://api.example.com'),
      matches: [A, C],
    },
  ],
  method: [{ name: 'method', filter: method('GET'), matches: [A, C] }],
  path: [{ name: 'path', filter: path('/other'), matches: [C] }],
  requestHeader: [
    { name: 'name only', filter: requestHeader('x-req'), matches: [A] },
    {
      name: 'name and value',
      filter: requestHeader('x-req', 'a'),
      matches: [A],
    },
  ],
  responseHeader: [
    { name: 'name only', filter: responseHeader('x-res'), matches: [A] },
    {
      name: 'name and value',
      filter: responseHeader('x-res', 'r'),
      matches: [A],
    },
  ],
  responseTrailer: [
    { name: 'name only', filter: responseTrailer('x-trail'), matches: [A] },
    {
      name: 'name and value',
      filter: responseTrailer('x-trail', 't'),
      matches: [A],
    },
  ],
  queryParam: [
    {
      name: 'name and value',
      filter: queryParameter('page', '1'),
      matches: [A],
    },
    {
      name: 'name is case-insensitive',
      filter: queryParameter('PAGE', '1'),
      matches: [A],
    },
    { name: 'name only', filter: queryParameter('page'), matches: [A, B] },
    {
      name: 'no matching value',
      filter: queryParameter('page', '3'),
      matches: [],
    },
    { name: 'no param', filter: queryParameter(), matches: [A, B, C] },
  ],
  statusCode: [{ name: 'statusCode', filter: statusCode(404), matches: [B] }],
  statusCodeRange: [
    {
      name: 'statusCodeRange',
      filter: statusCodeRange(200, 299),
      matches: [A, C],
    },
  ],
  hasBody: [{ name: 'hasBody', filter: hasRequestBody(), matches: [A] }],
  hasResponseBody: [
    { name: 'hasResponseBody', filter: hasResponseBody(), matches: [A] },
  ],
  requestMediaType: [
    {
      name: 'requestMediaType',
      filter: requestMediaType('application/json'),
      matches: [A],
    },
  ],
  responseMediaType: [
    {
      name: 'responseMediaType',
      filter: responseMediaType('text/plain'),
      matches: [C],
    },
  ],
  constant: [
    { name: 'true', filter: constant(true), matches: [A, B, C] },
    { name: 'false', filter: constant(false), matches: [] },
  ],
  and: [
    {
      name: 'and',
      filter: and(method('GET'), statusCode(200)),
      matches: [A, C],
    },
  ],
  or: [
    {
      name: 'or',
      filter: or(statusCode(404), path('/other')),
      matches: [B, C],
    },
  ],
  not: [
    { name: 'not', filter: not(method('GET')), matches: [B] },
    {
      name: 'not queryParam',
      filter: not(queryParameter('page')),
      matches: [C],
    },
  ],
  xor: [
    {
      name: 'xor',
      filter: xor(method('GET'), path('/items')),
      matches: [B, C],
    },
  ],
  url: [
    { name: 'url', filter: url('https://api.example.com/other'), matches: [C] },
  ],
  protocol: [{ name: 'protocol', filter: protocol('https'), matches: [A, C] }],
  'matches-origin': [
    { name: 'matches-origin', filter: matchesOrigin('other'), matches: [B] },
  ],
};

const unsupported: HttpFilterExpression[] = [
  responseWith(constant(true)),
  authorization(),
  port(443),
];

describe('compileHttpFilterToWhereClause', () => {
  let repo: SqliteHttpTransactionRepository;

  beforeEach(async () => {
    repo = new SqliteHttpTransactionRepository(':memory:', new NoopLogger());
    await repo.init();
    repo.insertHttpTransaction(transactionA);
    repo.insertHttpTransaction(transactionB);
    repo.insertHttpTransaction(transactionC);
  });

  afterEach(() => repo.close());

  describe.each(Object.entries(supported))('%s', (_type, cases) => {
    it.each(cases)(
      '$name selects the matching transactions',
      ({ filter, matches }) => {
        const paths = [...repo.readTransactionsByHttpFilter(filter)].map(
          (t) => t.request.data.path,
        );

        expect(paths.sort()).toEqual([...matches].sort());
      },
    );
  });

  it.each(unsupported)(
    'rejects $type, which has no SQL translation',
    (filter) => {
      expect(() => compileHttpFilterToWhereClause(filter)).toThrow(
        /not supported for SQL translation/,
      );
    },
  );

  it('honours custom table aliases in every branch', () => {
    const names = { requests: 'r', responses: 'p' };
    const filters = Object.values(supported)
      .flat()
      .map((c) => c.filter);

    for (const filter of filters) {
      const { sql, params } = compileHttpFilterToWhereClause(filter, names);

      expect(() =>
        repo.db
          .prepare(
            `SELECT r.id FROM http_transaction t
             JOIN http_request r ON r.id = t.request_id
             JOIN http_response p ON p.id = t.response_id
             WHERE ${sql}`,
          )
          .all(...params),
      ).not.toThrow();
    }
  });
});
