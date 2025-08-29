import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { HttpRequest, HttpResponse, Logger } from '@thymian/core';
import SqliteDb, { type Database } from 'better-sqlite3';

import {
  insertHttpRequest,
  insertHttpResponse,
  insertHttpTransaction,
  insertRequestHeader,
  insertResponseHeader,
  insertResponseTrailer,
} from './statements.js';

export class HttpTransactionRepository {
  readonly db: Database;

  constructor(location: string, private readonly logger: Logger) {
    this.db = new SqliteDb(location);
    this.db.pragma('journal_mode = WAL');
  }

  async init(): Promise<void> {
    this.logger.info('Initializing database for HttpTransactionRepository.');

    const init = await readFile(join(import.meta.dirname, 'init.sql'), 'utf-8');

    this.db.exec(init);
  }

  insertHttpTransaction(req: HttpRequest, res: HttpResponse): void {
    this.db.transaction(() => {
      const reqId = this.db.prepare(insertHttpRequest).run({
        body: undefined,
        bodyEncoding: undefined,
        ...req,
      }).lastInsertRowid;

      const resId = this.db.prepare(insertHttpResponse).run({
        body: undefined,
        bodyEncoding: undefined,
        ...res,
      }).lastInsertRowid;

      this.db.prepare(insertHttpTransaction).run(reqId, resId);

      this.insertHeaders(req.headers, insertRequestHeader, reqId);
      this.insertHeaders(res.headers, insertResponseHeader, resId);
      this.insertTrailers(res.trailers, resId);
    })();
  }

  readTransactionFromId(transactionId: string): [HttpRequest, HttpResponse] {
    const transactionStatement = this.db.prepare<unknown[], any>(`
        SELECT 
          t.id AS transactionId, 
          t.timestamp, 
          req.id AS reqId, 
          res.id AS resId,
          req.method AS method, 
          req.origin AS origin, 
          req.path AS path, 
          req.body as reqBody, 
          req.body_encoding as reqBodyEncoding, 
          res.status_code AS statusCode,  
          res.duration AS duration, 
          res.body AS resBody, 
          res.body_encoding AS resBodyEncoding
        FROM http_transaction t
        JOIN http_request req ON req.id  = t.request_id
        JOIN http_response res ON res.id = t.response_id
        WHERE t.id = ?
    `);

    const result = transactionStatement.get(transactionId);

    const req: HttpRequest = {
      method: result.method,
      origin: result.origin,
      path: result.path,
      body: result.reqBody,
      bodyEncoding: result.reqBodyEncoding,
    };

    const res: HttpResponse = {
      headers: {},
      duration: result.duration,
      statusCode: result.statusCode,
      trailers: {},
      body: result.resBody,
      bodyEncoding: result.resBodyEncoding,
    };

    const getReqHeaders = this.db.prepare<
      [string],
      { name: string; value: string }
    >(`
        SELECT name, value 
        FROM http_request_header 
        WHERE request_id = ? 
    `);

    const reqHeaders: Record<string, string | string[] | undefined> = {};
    for (const header of getReqHeaders.iterate(result.reqId)) {
      reqHeaders[header.name] = header.value;
    }
    req.headers = reqHeaders;

    const getResHeaders = this.db.prepare<
      [string],
      { name: string; value: string }
    >(`
        SELECT name, value 
        FROM http_response_header 
        WHERE response_id = ? 
    `);

    const resHeaders: Record<string, string | string[] | undefined> = {};
    for (const header of getResHeaders.iterate(result.resId)) {
      resHeaders[header.name] = header.value;
    }
    res.headers = resHeaders;

    return [req, res];
  }

  private insertQueryParameters(
    queryParameters: Record<string, string | string[] | undefined> | undefined,
    statement: string,
    id: number | bigint
  ): void {
    if (!queryParameters) {
      return;
    }

    const preparedStatement = this.db.prepare(statement);
  }

  private insertHeaders(
    headers: Record<string, string | string[] | undefined> | undefined,
    statement: string,
    id: number | bigint
  ): void {
    if (!headers) {
      return;
    }

    const preparedStatement = this.db.prepare(statement);

    for (const [name, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        preparedStatement.run({
          name,
          value,
          id,
        });
      } else if (Array.isArray(value)) {
        for (const val of value) {
          preparedStatement.run({
            name,
            value: val,
            id,
          });
        }
      }
    }
  }

  private insertTrailers(
    trailers: Record<string, string> | undefined,
    responseId: number | bigint
  ): void {
    if (!trailers) return;

    const stmt = this.db.prepare(insertResponseTrailer);
    for (const [name, value] of Object.entries(trailers)) {
      stmt.run({ name, value, id: responseId });
    }
  }
}
