import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { HttpFilterExpression, Logger } from '@thymian/core';
import SqliteDb, { type Database, type Statement } from 'better-sqlite3';

import type { HttpParticipantRole } from '../../rule/rule-meta.js';
import type {
  CapturedHttpRequest,
  CapturedHttpResponse,
  CapturedTrace,
  CapturedTransaction,
} from '../../types.js';
import type { HttpTransactionRepository } from '../http-transaction-repository.js';
import {
  httpFilterToGroupByClause,
  httpFilterToGroupingKey,
} from './http-filter-to-groupby-clause.js';
import { compileHttpFilterToWhereClause } from './http-filter-to-where-clause.js';

type TransactionIdDb = {
  id: number;
  parent_transaction_id: number | null;
};

function sortTraceTransactions(
  transactions: TransactionIdDb[],
): TransactionIdDb[] {
  const nextElementMap = new Map<number, TransactionIdDb>();

  let currentElement: TransactionIdDb | undefined;

  transactions.forEach((item) => {
    if (item.parent_transaction_id === null) {
      currentElement = item;
    } else {
      nextElementMap.set(item.parent_transaction_id, item);
    }
  });

  const sortedList: TransactionIdDb[] = [];

  while (currentElement) {
    sortedList.push(currentElement);

    currentElement = nextElementMap.get(currentElement.id);
  }

  return sortedList;
}

export class SqliteHttpTransactionRepository
  implements HttpTransactionRepository
{
  readonly db: Database;

  constructor(
    location = ':memory:',
    private readonly logger: Logger,
  ) {
    this.db = new SqliteDb(location);
    this.db.pragma('journal_mode = WAL');
  }

  async init(): Promise<void> {
    this.logger.debug('Initializing database for HttpTransactionRepository.');

    const init = await readFile(join(import.meta.dirname, 'init.sql'), 'utf-8');

    this.db.exec(init);
  }

  *readAndGroupTransactionsByHttpFilter(
    filter: HttpFilterExpression,
    groupBy: HttpFilterExpression,
    role?: HttpParticipantRole[],
  ): IterableIterator<[string, CapturedTransaction[]], void, unknown> {
    const params = [];

    const whereFragment = compileHttpFilterToWhereClause(filter, {
      requests: 'req',
      responses: 'res',
    });
    const groupByFragment = httpFilterToGroupByClause(groupBy, {
      requests: 'req',
      responses: 'res',
    });
    const groupingKey = httpFilterToGroupingKey(groupBy, {
      requests: 'req',
      responses: 'res',
    });

    params.push(...whereFragment.params, ...groupByFragment.params);

    let whereClause = whereFragment.sql;

    if (role?.length) {
      whereClause += this.rolesToWhereClause(role);
      params.push(...role, ...role);
    }

    const statement = `
      SELECT
        GROUP_CONCAT(t.id, ',') AS transactionIds,
        ${groupingKey} AS grouping_key,
        ${groupByFragment.sql}
      FROM http_transaction t
      JOIN http_request req ON req.id = t.request_id
      JOIN http_response res ON res.id = t.response_id
      LEFT JOIN communication_role reqRole ON req.role_id = reqRole.id
      LEFT JOIN communication_role resRole ON res.role_id = resRole.id
      WHERE ${whereClause}
      GROUP BY ${groupByFragment.sql}
    `;

    this.logger.debug('Executing SQL query:', statement);
    this.logger.debug('Executing SQL query:', statement);

    const result = this.db
      .prepare<
        unknown[],
        { transactionIds: string; grouping_key: string }
      >(statement)
      .iterate(params);

    for (const { transactionIds, grouping_key } of result) {
      const ids = transactionIds.split(',').map((id) => parseInt(id));
      const transactions = ids.map((id) => {
        const transaction = this.readTransactionById(id);

        if (!transaction) {
          throw new Error(`Transaction with id ${id} not found`);
        }

        return transaction;
      });

      yield [grouping_key, transactions];
    }
  }

  private rolesToWhereClause(roles?: HttpParticipantRole[]): string {
    if (!roles || roles.length === 0) {
      return '';
    }

    return ` AND (reqRole.name IN (${roles.map(() => '?').join(', ')}) OR resRole.name IN (${roles.map(() => '?').join(', ')}))`;
  }

  *readTransactionsByHttpFilter(
    filter: HttpFilterExpression,
    roles?: HttpParticipantRole[],
  ): IterableIterator<CapturedTransaction, void, unknown> {
    let whereClause = '';

    const { sql, params } = compileHttpFilterToWhereClause(filter, {
      requests: 'req',
      responses: 'res',
    });

    if (roles?.length) {
      params.push(...roles);
      params.push(...roles);

      whereClause = sql + this.rolesToWhereClause(roles);
    } else {
      whereClause = sql;
    }

    const rawStatement = `
      SELECT
        t.id as trans_id,
        req.id as req_id,
        req.origin as req_origin,
        req.path as req_path,
        req.method as req_method,
        req.body as req_body,
        req.body_encoding as req_body_encoding,
        res.id as res_id,
        res.status_code as res_status,
        res.duration as res_duration,
        res.body as res_body,
        res.body_encoding as res_body_encoding,
        reqRole.name as req_role_name,
        resRole.name as res_role_name
      FROM http_transaction t
      JOIN http_request req ON t.request_id = req.id
      JOIN http_response res ON t.response_id = res.id
      LEFT JOIN communication_role reqRole ON req.role_id = reqRole.id
      LEFT JOIN communication_role resRole ON res.role_id = resRole.id
      WHERE ${whereClause}
    `;

    this.logger.debug('Executing SQL query:', rawStatement);

    const statement = this.db.prepare<
      unknown[],
      {
        id: number;
        req_id: number;
        res_id: number;
        req_origin: string;
        req_path: string;
        req_method: string;
        req_body?: string;
        req_body_encoding?: string;
        req_role_name: HttpParticipantRole;
        res_status: number;
        res_duration: number;
        res_body?: string;
        res_body_encoding: string;
        res_role_name: HttpParticipantRole;
      }
    >(rawStatement);

    for (const row of statement.iterate(...params)) {
      const transaction: CapturedTransaction = {
        request: {
          data: {
            origin: row.req_origin,
            path: row.req_path,
            method: row.req_method,
            body: row.req_body || undefined,
            bodyEncoding: row.req_body_encoding || undefined,
            headers: this.readRequestHeadersById(row.req_id),
          },
          meta: {
            role: row.req_role_name,
          },
        },
        response: {
          data: {
            statusCode: row.res_status,
            duration: row.res_duration,
            body: row.res_body || undefined,
            bodyEncoding: row.res_body_encoding || undefined,
            headers: this.readResponseHeadersById(row.res_id),
            trailers: this.readResponseTrailersById(row.res_id),
          },
          meta: {
            role: row.res_role_name,
          },
        },
      };

      yield transaction;
    }
  }

  insertHttpTrace(trace: CapturedTrace): number {
    const insertTrace = this.db.transaction(() => {
      // Insert trace
      const traceStmt = this.db.prepare(
        'INSERT INTO http_trace DEFAULT VALUES',
      );
      const traceResult = traceStmt.run();
      const traceId = traceResult.lastInsertRowid as number;

      // Insert all transactions in the trace with parent-child relationships
      let parentTransactionId: number | undefined = undefined;
      for (const transaction of trace) {
        const transactionId = this.insertTransactionForTrace(
          transaction,
          traceId,
          parentTransactionId,
        );
        parentTransactionId = transactionId;
      }

      return traceId;
    });

    return insertTrace();
  }

  readTraceById(id: number): CapturedTrace | undefined {
    const traceStmt = this.db.prepare('SELECT id FROM http_trace WHERE id = ?');
    const traceRow = traceStmt.get(id) as { id: number } | undefined;

    if (!traceRow) {
      return undefined;
    }

    const transactionsStmt = this.db.prepare(`
      SELECT id, parent_transaction_id FROM http_transaction
      WHERE trace_id = ?
    `);
    const transactionRows = transactionsStmt.all(traceRow.id) as Array<{
      id: number;
      parent_transaction_id: number | null;
    }>;

    const sortedTransactions = sortTraceTransactions(transactionRows);

    const trace: CapturedTrace = [];
    for (const row of sortedTransactions) {
      const transaction = this.readTransactionById(row.id);
      if (transaction) {
        trace.push(transaction);
      }
    }

    return trace.length > 0 ? trace : undefined;
  }

  insertHttpTransaction(transaction: CapturedTransaction): number {
    const insertTransaction = this.db.transaction(() => {
      // Create a trace for this single transaction
      const traceStmt = this.db.prepare(
        'INSERT INTO http_trace DEFAULT VALUES',
      );
      const traceResult = traceStmt.run();
      const traceId = traceResult.lastInsertRowid as number;

      return this.insertTransactionForTrace(transaction, traceId);
    });

    return insertTransaction();
  }

  readTransactionById(id: number): CapturedTransaction | undefined {
    // Get transaction
    const transactionStmt = this.db.prepare(`
      SELECT request_id, response_id FROM http_transaction WHERE id = ?
    `);
    const transactionRow = transactionStmt.get(id) as
      | { request_id: number; response_id: number }
      | undefined;

    if (!transactionRow) {
      return;
    }

    const request = this.readRequestById(transactionRow.request_id);

    if (!request) {
      return;
    }

    const response = this.readResponseById(transactionRow.response_id);

    if (!response) {
      return;
    }

    return {
      request,
      response,
    };
  }

  private readResponseById(id: number): CapturedHttpResponse | undefined {
    const responseStmt = this.db.prepare<
      unknown[],
      {
        status_code: number;
        body: string | undefined;
        body_encoding: string | undefined;
        duration: number;
        role_id: number;
        role_name: HttpParticipantRole;
      }
    >(`
      SELECT res.*, role.name as role_name
      FROM http_response res
      LEFT JOIN communication_role role ON res.role_id = role.id
      WHERE res.id = ?
    `);
    const responseRow = responseStmt.get(id);

    if (!responseRow) {
      return;
    }

    const responseHeaders = this.readResponseHeadersById(id);

    const responseTrailers = this.readResponseTrailersById(id);

    return {
      data: {
        statusCode: responseRow.status_code,
        headers: responseHeaders,
        body: responseRow.body || undefined,
        bodyEncoding: responseRow.body_encoding || undefined,
        trailers: responseTrailers,
        duration: responseRow.duration,
      },
      meta: {
        role: responseRow.role_name,
      },
    };
  }

  private readResponseTrailersById(id: number): Record<string, string> {
    const responseTrailersStmt = this.db.prepare(`
      SELECT name, value FROM http_response_trailer WHERE response_id = ?
    `);
    const responseTrailerRows = responseTrailersStmt.all(id) as Array<{
      name: string;
      value: string;
    }>;

    const responseTrailers: Record<string, string> = {};
    for (const trailer of responseTrailerRows) {
      responseTrailers[trailer.name] = trailer.value;
    }

    return responseTrailers;
  }

  private readRequestById(id: number): CapturedHttpRequest | undefined {
    const requestStmt = this.db.prepare<
      unknown[],
      {
        origin: string;
        path: string;
        method: string;
        body: string | undefined;
        body_encoding: string | undefined;
        role_id: number;
        role_name: HttpParticipantRole;
      }
    >(`
      SELECT req.*, role.name as role_name
      FROM http_request req
      LEFT JOIN communication_role role ON req.role_id = role.id
      WHERE req.id = ?
    `);
    const requestRow = requestStmt.get(id);

    if (!requestRow) {
      return;
    }

    const requestHeaders = this.readRequestHeadersById(id);
    const queryParameters = this.readQueryParametersById(id);

    const path = queryParameters
      ? new URL(requestRow.path, requestRow.origin).pathname +
        '?' +
        queryParameters
      : requestRow.path;

    return {
      data: {
        origin: requestRow.origin,
        path,
        method: requestRow.method,
        bodyEncoding: requestRow.body_encoding || undefined,
        body: requestRow.body || undefined,
        headers: requestHeaders,
      },
      meta: {
        role: requestRow.role_name,
      },
    };
  }

  private readQueryParametersById(id: number): string | undefined {
    // the ORDER BY is required to ensure that the query parameters are returned in the same order as they were inserted
    const queryParametersStmt = this.db.prepare(`
      SELECT name, value, id
      FROM http_request_query_parameter
      WHERE request_id = ?
      ORDER BY id ASC
    `);
    const queryParameterRows = queryParametersStmt.all(id) as Array<{
      name: string;
      value: string;
    }>;

    const queryParameters = new URLSearchParams();
    for (const parameter of queryParameterRows) {
      queryParameters.append(parameter.name, parameter.value);
    }

    if (queryParameters.size === 0) {
      return;
    }

    return queryParameters.toString();
  }

  private readResponseHeadersById(
    id: number,
  ): Record<string, string | string[]> {
    const responseHeadersStmt = this.db.prepare(`
      SELECT name, value FROM http_response_header WHERE response_id = ?
    `);

    const responseHeaderRows = responseHeadersStmt.all(id) as Array<{
      name: string;
      value: string;
    }>;

    const responseHeaders: Record<string, string | string[]> = {};
    for (const header of responseHeaderRows) {
      if (responseHeaders[header.name]) {
        const existing = responseHeaders[header.name];
        responseHeaders[header.name] = (
          Array.isArray(existing)
            ? [...existing, header.value]
            : [existing, header.value]
        ).filter((x) => typeof x !== 'undefined');
      } else {
        responseHeaders[header.name] = header.value;
      }
    }

    return responseHeaders;
  }

  private readRequestHeadersById(
    id: number,
  ): Record<string, string | string[]> {
    const requestHeadersStmt = this.db.prepare(`
      SELECT name, value FROM http_request_header WHERE request_id = ?
    `);

    const requestHeaderRows = requestHeadersStmt.all(id) as Array<{
      name: string;
      value: string;
    }>;

    const requestHeaders: Record<string, string | string[]> = {};
    for (const header of requestHeaderRows) {
      if (requestHeaders[header.name]) {
        const existing = requestHeaders[header.name];
        requestHeaders[header.name] = (
          Array.isArray(existing)
            ? [...existing, header.value]
            : [existing, header.value]
        ).filter((x) => typeof x !== 'undefined');
      } else {
        requestHeaders[header.name] = header.value;
      }
    }

    return requestHeaders;
  }

  private insertTransactionForTrace(
    transaction: CapturedTransaction,
    traceId: number,
    parentTransactionId?: number,
  ): number {
    // Get role IDs
    const requestRoleId = this.getRoleId(transaction.request.meta.role);
    const responseRoleId = this.getRoleId(transaction.response.meta.role);

    // Insert request
    const requestStmt = this.db.prepare(`
      INSERT INTO http_request (origin, path, method, body_encoding, body, role_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const url = new URL(
      transaction.request.data.path,
      transaction.request.data.origin,
    );

    const requestResult = requestStmt.run(
      url.origin,
      url.pathname,
      transaction.request.data.method,
      transaction.request.data.bodyEncoding || null,
      transaction.request.data.body || null,
      requestRoleId,
    );
    const requestId = requestResult.lastInsertRowid as number;

    // Insert request headers and query parameters
    this.insertRequestHeaders(requestId, transaction.request.data.headers);
    this.insertQueryParameters(requestId, url.searchParams);

    // Insert response
    const responseStmt = this.db.prepare(`
      INSERT INTO http_response (status_code, body, body_encoding, duration, role_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    const responseResult = responseStmt.run(
      transaction.response.data.statusCode,
      transaction.response.data.body || null,
      transaction.response.data.bodyEncoding || null,
      transaction.response.data.duration,
      responseRoleId,
    );
    const responseId = responseResult.lastInsertRowid as number;

    // Insert response headers and trailers
    this.insertResponseHeaders(responseId, transaction.response.data.headers);
    this.insertResponseTrailers(responseId, transaction.response.data.trailers);

    // Insert transaction
    const transactionStmt = this.db.prepare(`
      INSERT INTO http_transaction (request_id, response_id, trace_id, parent_transaction_id)
      VALUES (?, ?, ?, ?)
    `);
    const transactionResult = transactionStmt.run(
      requestId,
      responseId,
      traceId,
      parentTransactionId ?? null,
    );

    return transactionResult.lastInsertRowid as number;
  }

  private insertRequestHeaders(
    requestId: number,
    headers?: Record<string, string | string[] | undefined>,
  ): void {
    if (!headers) {
      return;
    }

    const headerStmt = this.db.prepare(`
      INSERT INTO http_request_header (request_id, name, value)
      VALUES (?, ?, ?)
    `);

    this.insertHeaders(headers, headerStmt, requestId);
  }

  private insertQueryParameters(
    requestId: number,
    searchParams: URLSearchParams,
  ): void {
    if (searchParams.size === 0) {
      return;
    }

    const queryStmt = this.db.prepare(`
      INSERT INTO http_request_query_parameter (request_id, name, value)
      VALUES (?, ?, ?)
    `);

    for (const [name, value] of searchParams.entries()) {
      queryStmt.run(requestId, name, value);
    }
  }

  private insertResponseHeaders(
    responseId: number,
    headers?: Record<string, string | string[] | undefined>,
  ): void {
    if (!headers) {
      return;
    }

    const headerStmt = this.db.prepare(`
      INSERT INTO http_response_header (response_id, name, value)
      VALUES (?, ?, ?)
    `);

    this.insertHeaders(headers, headerStmt, responseId);
  }

  private insertHeaders(
    headers: Record<string, string | string[] | undefined>,
    statement: Statement,
    id: number | bigint,
  ): void {
    for (const [name, value] of Object.entries(headers)) {
      if (value !== undefined) {
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
          statement.run(id, name, v);
        }
      }
    }
  }

  private insertResponseTrailers(
    responseId: number,
    trailers?: Record<string, string>,
  ): void {
    if (!trailers) {
      return;
    }

    const trailerStmt = this.db.prepare(`
      INSERT INTO http_response_trailer (response_id, name, value)
      VALUES (?, ?, ?)
    `);

    for (const [name, value] of Object.entries(trailers)) {
      trailerStmt.run(responseId, name, value);
    }
  }

  private getRoleId(roleName: string | undefined | null): number | null {
    if (roleName === null || roleName === undefined) {
      return null;
    }

    const stmt = this.db.prepare(
      'SELECT id FROM communication_role WHERE name = ?',
    );
    const row = stmt.get(roleName) as { id: number } | undefined;
    return row?.id || null;
  }

  close(): void {
    this.db.close();
  }
}
