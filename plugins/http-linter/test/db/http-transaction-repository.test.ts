import { type HttpRequest, type HttpResponse, NoopLogger } from '@thymian/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { HttpTransactionRepository } from '../../src/db/http-transaction-repository.js';

describe('HttpTransactionRepository', () => {
  let repo: HttpTransactionRepository;
  const logger = new NoopLogger();

  beforeEach(async () => {
    repo = new HttpTransactionRepository(':memory:', logger);
    await repo.init();
  });

  it('should initialize database without error', async () => {
    const tables = repo.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r: { name: string }) => r.name);

    expect(tables).toContain('http_request');
    expect(tables).toContain('http_response');
    expect(tables).toContain('http_transaction');
    expect(tables).toContain('http_request_header');
    expect(tables).toContain('http_response_header');
    expect(tables).toContain('http_response_trailer');
    expect(tables).toContain('http_request_query_parameter');
  });

  it('should insert and read back a simple transaction (path normalized, headers roundtrip)', () => {
    const req: HttpRequest = {
      method: 'GET',
      origin: 'https://api.example.com',
      path: '/users?foo=bar',
      headers: { accept: 'application/json' },
      body: 'request-body',
      bodyEncoding: 'utf-8',
    };

    const res: HttpResponse = {
      statusCode: 200,
      duration: 123.45,
      headers: { 'content-type': 'application/json' },
      trailers: {},
      body: 'response-body',
      bodyEncoding: 'utf-8',
    };

    const id = repo.insertHttpTransaction(req, res);

    const [savedReq, savedRes] = repo.readTransactionById(id);

    expect(savedReq.path).toBe('/users');
    expect(savedReq.method).toBe('GET');
    expect(savedReq.origin).toBe('https://api.example.com');
    expect(savedReq.body).toBe('request-body');
    expect(savedReq.bodyEncoding).toBe('utf-8');

    expect(savedRes.statusCode).toBe(200);
    expect(savedRes.duration).toBeCloseTo(123.45);
    expect(savedRes.body).toBe('response-body');
    expect(savedRes.bodyEncoding).toBe('utf-8');

    expect(savedReq.headers).toMatchObject({
      accept: 'application/json',
    });
    expect(savedRes.headers).toMatchObject({
      'content-type': 'application/json',
    });
  });

  it('should insert multiple header rows when array values are provided for request/response headers', () => {
    const req: HttpRequest = {
      method: 'GET',
      origin: 'https://api.example.com',
      path: '/items',
      headers: { 'x-flag': ['a', 'b', 'c'] },
    };

    const res: HttpResponse = {
      statusCode: 204,
      duration: 5,
      headers: { vary: ['accept-encoding', 'accept-language'] },
      trailers: {},
    };

    const id = repo.insertHttpTransaction(req, res);
    const row = repo.db
      .prepare(
        `SELECT request_id, response_id FROM http_transaction WHERE id = ?`,
      )
      .get(id) as { request_id: number; response_id: number };

    const reqHeaderCount = repo.db
      .prepare(
        `SELECT COUNT(1) as cnt FROM http_request_header WHERE request_id = ? AND name = 'x-flag'`,
      )
      .get(row.request_id) as { cnt: number };

    const resHeaderCount = repo.db
      .prepare(
        `SELECT COUNT(1) as cnt FROM http_response_header WHERE response_id = ? AND name = 'vary'`,
      )
      .get(row.response_id) as { cnt: number };

    expect(reqHeaderCount.cnt).toBe(3);
    expect(resHeaderCount.cnt).toBe(2);

    // readTransactionById flattens duplicate header names to last value
    const [, savedRes] = repo.readTransactionById(id);
    expect(savedRes.headers['vary']).toBe('accept-language');
  });

  it('should insert trailers to dedicated table (read returns empty trailers)', () => {
    const req: HttpRequest = {
      method: 'GET',
      origin: 'https://api.example.com',
      path: '/stream',
    };

    const res: HttpResponse = {
      statusCode: 200,
      duration: 10,
      headers: {},
      trailers: { checksum: 'abc123', end: 'true' },
    };

    const id = repo.insertHttpTransaction(req, res);

    const row = repo.db
      .prepare(`SELECT response_id FROM http_transaction WHERE id = ?`)
      .get(id) as { response_id: number };

    const trailerCount = repo.db
      .prepare(
        `SELECT COUNT(1) as cnt FROM http_response_trailer WHERE response_id = ?`,
      )
      .get(row.response_id) as { cnt: number };

    expect(trailerCount.cnt).toBe(2);

    const [, savedRes] = repo.readTransactionById(id);
    expect(savedRes.trailers).toEqual({});
  });

  it('should store query parameters and normalize path correctly', () => {
    const req: HttpRequest = {
      method: 'POST',
      origin: 'https://api.example.com',
      path: '/search?q=thymian&q=core&page=2',
    };

    const res: HttpResponse = {
      statusCode: 201,
      duration: 1,
      headers: {},
      trailers: {},
    };

    const id = repo.insertHttpTransaction(req, res);

    const row = repo.db
      .prepare(`SELECT request_id FROM http_transaction WHERE id = ?`)
      .get(id) as { request_id: number };

    const qpRows = repo.db
      .prepare(
        `SELECT name, value FROM http_request_query_parameter WHERE request_id = ? ORDER BY id`,
      )
      .all(row.request_id) as Array<{ name: string; value: string }>;

    expect(qpRows).toEqual([
      { name: 'q', value: 'thymian' },
      { name: 'q', value: 'core' },
      { name: 'page', value: '2' },
    ]);

    const [savedReq] = repo.readTransactionById(id);
    expect(savedReq.path).toBe('/search');
  });

  it('should handle undefined headers and empty query gracefully', () => {
    const req: HttpRequest = {
      method: 'DELETE',
      origin: 'http://localhost',
      path: '/resource',
      // headers undefined
    } as HttpRequest;

    const res: HttpResponse = {
      statusCode: 404,
      duration: 0.5,
      headers: undefined as unknown as Record<string, string>,
      trailers: undefined as unknown as Record<string, string>,
    };

    const id = repo.insertHttpTransaction(req, res);

    const row = repo.db
      .prepare(
        `SELECT request_id, response_id FROM http_transaction WHERE id = ?`,
      )
      .get(id) as { request_id: number; response_id: number };

    const reqHeaderCount = repo.db
      .prepare(
        `SELECT COUNT(1) as cnt FROM http_request_header WHERE request_id = ?`,
      )
      .get(row.request_id) as { cnt: number };

    const resHeaderCount = repo.db
      .prepare(
        `SELECT COUNT(1) as cnt FROM http_response_header WHERE response_id = ?`,
      )
      .get(row.response_id) as { cnt: number };

    const qpCount = repo.db
      .prepare(
        `SELECT COUNT(1) as cnt FROM http_request_query_parameter WHERE request_id = ?`,
      )
      .get(row.request_id) as { cnt: number };

    expect(reqHeaderCount.cnt).toBe(0);
    expect(resHeaderCount.cnt).toBe(0);
    expect(qpCount.cnt).toBe(0);

    const [savedReq, savedRes] = repo.readTransactionById(id);
    expect(savedReq.headers).toEqual({});
    expect(savedRes.headers).toEqual({});
  });
});
