import { readFileSync } from 'node:fs';

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

const ITEMS_PAGE_1 = '/items?page=1&sort=asc';
const ITEMS_PAGE_2 = '/items?page=2';
const OTHER = '/other';

const itemsPage1Transaction: CapturedTransaction = {
  request: {
    data: {
      method: 'GET',
      origin: 'https://api.example.com',
      path: ITEMS_PAGE_1,
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

const itemsPage2Transaction: CapturedTransaction = {
  request: {
    data: {
      method: 'POST',
      origin: 'http://other.example.com',
      path: ITEMS_PAGE_2,
    },
    meta: { role: 'client' },
  },
  response: {
    data: { statusCode: 404, headers: {}, trailers: {}, duration: 1 },
    meta: { role: 'server' },
  },
};

const otherTransaction: CapturedTransaction = {
  request: {
    data: { method: 'GET', origin: 'https://api.example.com', path: OTHER },
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
      matches: [ITEMS_PAGE_1, OTHER],
    },
  ],
  method: [
    { name: 'method', filter: method('GET'), matches: [ITEMS_PAGE_1, OTHER] },
  ],
  path: [{ name: 'path', filter: path('/other'), matches: [OTHER] }],
  requestHeader: [
    {
      name: 'name only',
      filter: requestHeader('x-req'),
      matches: [ITEMS_PAGE_1],
    },
    {
      name: 'name and value',
      filter: requestHeader('x-req', 'a'),
      matches: [ITEMS_PAGE_1],
    },
  ],
  responseHeader: [
    {
      name: 'name only',
      filter: responseHeader('x-res'),
      matches: [ITEMS_PAGE_1],
    },
    {
      name: 'name and value',
      filter: responseHeader('x-res', 'r'),
      matches: [ITEMS_PAGE_1],
    },
  ],
  responseTrailer: [
    {
      name: 'name only',
      filter: responseTrailer('x-trail'),
      matches: [ITEMS_PAGE_1],
    },
    {
      name: 'name and value',
      filter: responseTrailer('x-trail', 't'),
      matches: [ITEMS_PAGE_1],
    },
  ],
  queryParam: [
    {
      name: 'name and value',
      filter: queryParameter('page', '1'),
      matches: [ITEMS_PAGE_1],
    },
    {
      name: 'name is case-insensitive',
      filter: queryParameter('PAGE', '1'),
      matches: [ITEMS_PAGE_1],
    },
    {
      name: 'name only',
      filter: queryParameter('page'),
      matches: [ITEMS_PAGE_1, ITEMS_PAGE_2],
    },
    {
      name: 'no matching value',
      filter: queryParameter('page', '3'),
      matches: [],
    },
    {
      name: 'no param',
      filter: queryParameter(),
      matches: [ITEMS_PAGE_1, ITEMS_PAGE_2, OTHER],
    },
  ],
  statusCode: [
    { name: 'statusCode', filter: statusCode(404), matches: [ITEMS_PAGE_2] },
  ],
  statusCodeRange: [
    {
      name: 'statusCodeRange',
      filter: statusCodeRange(200, 299),
      matches: [ITEMS_PAGE_1, OTHER],
    },
  ],
  hasBody: [
    { name: 'hasBody', filter: hasRequestBody(), matches: [ITEMS_PAGE_1] },
  ],
  hasResponseBody: [
    {
      name: 'hasResponseBody',
      filter: hasResponseBody(),
      matches: [ITEMS_PAGE_1],
    },
  ],
  requestMediaType: [
    {
      name: 'requestMediaType',
      filter: requestMediaType('application/json'),
      matches: [ITEMS_PAGE_1],
    },
  ],
  responseMediaType: [
    {
      name: 'responseMediaType',
      filter: responseMediaType('text/plain'),
      matches: [OTHER],
    },
  ],
  constant: [
    {
      name: 'true',
      filter: constant(true),
      matches: [ITEMS_PAGE_1, ITEMS_PAGE_2, OTHER],
    },
    { name: 'false', filter: constant(false), matches: [] },
  ],
  and: [
    {
      name: 'and',
      filter: and(method('GET'), statusCode(200)),
      matches: [ITEMS_PAGE_1, OTHER],
    },
  ],
  or: [
    {
      name: 'or',
      filter: or(statusCode(404), path('/other')),
      matches: [ITEMS_PAGE_2, OTHER],
    },
  ],
  not: [
    { name: 'not', filter: not(method('GET')), matches: [ITEMS_PAGE_2] },
    {
      name: 'not queryParam',
      filter: not(queryParameter('page')),
      matches: [OTHER],
    },
  ],
  xor: [
    {
      name: 'xor',
      filter: xor(method('GET'), path('/items')),
      matches: [ITEMS_PAGE_2, OTHER],
    },
  ],
  url: [
    {
      name: 'url',
      filter: url('https://api.example.com/other'),
      matches: [OTHER],
    },
  ],
  protocol: [
    {
      name: 'protocol',
      filter: protocol('https'),
      matches: [ITEMS_PAGE_1, OTHER],
    },
  ],
  'matches-origin': [
    {
      name: 'matches-origin',
      filter: matchesOrigin('other'),
      matches: [ITEMS_PAGE_2],
    },
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
    repo.insertHttpTransaction(itemsPage1Transaction);
    repo.insertHttpTransaction(itemsPage2Transaction);
    repo.insertHttpTransaction(otherTransaction);
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

  it('has a case for every filter type declared in @thymian/core', () => {
    const source = readFileSync(
      new URL('../../../core/src/http-filter.ts', import.meta.url),
      'utf-8',
    );
    const declared = [
      ...source
        .slice(0, source.indexOf('export const methods'))
        .matchAll(/type: '([^']+)'/g),
    ].map((m) => m[1]);
    const covered = [
      ...Object.keys(supported),
      ...unsupported.map((filter) => filter.type),
    ];

    expect(new Set(declared).size).toBeGreaterThan(0);
    expect(covered.sort()).toEqual([...new Set(declared)].sort());
  });
});
