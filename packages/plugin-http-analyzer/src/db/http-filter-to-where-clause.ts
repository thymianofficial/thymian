import { and, type HttpFilterExpression, origin, path } from '@thymian/core';

import type { TableNames } from './types.js';
import { parenthesize, type SqlFragment } from './utils.js';

export function compileHttpFilterToWhereClause(
  filter: HttpFilterExpression,
  names: Partial<TableNames> = {},
): SqlFragment {
  const tableNames: TableNames = {
    requests: 'req',
    responses: 'res',
    ...names,
  };

  switch (filter.type) {
    case 'origin':
      return {
        sql: `${tableNames.requests}.origin = ?`,
        params: [filter.origin],
      };

    case 'method':
      return {
        sql: `${tableNames.requests}.method = ? COLLATE NOCASE`,
        params: [filter.method],
      };

    case 'path':
      return { sql: `${tableNames.requests}.path = ?`, params: [filter.path] };

    case 'requestHeader': {
      const base = `
        EXISTS (
          SELECT 1
          FROM http_request_header reqHeader
          WHERE reqHeader.request_id = ${tableNames.requests}.id
          AND reqHeader.name = ? COLLATE NOCASE`;
      if (typeof filter.value === 'undefined') {
        return { sql: `${base})`, params: [filter.header] };
      }
      return {
        sql: `${base} AND reqHeader.value = ?)`,
        params: [filter.header, String(filter.value)],
      };
    }

    case 'responseHeader': {
      const base = `
        EXISTS (
          SELECT 1
          FROM http_response_header resHeader
          WHERE resHeader.response_id = res.id
          AND resHeader.name = ? COLLATE NOCASE`;
      if (typeof filter.value === 'undefined') {
        return { sql: `${base})`, params: [filter.header] };
      }
      return {
        sql: `${base} AND resHeader.value = ?)`,
        params: [filter.header, String(filter.value)],
      };
    }

    case 'responseTrailer': {
      const base = `
        EXISTS (
          SELECT 1
          FROM http_response_trailer resTrailer
          WHERE resTrailer.response_id = res.id
          AND resTrailer.name = ? COLLATE NOCASE`;
      if (typeof filter.value === 'undefined') {
        return { sql: `${base})`, params: [filter.trailer] };
      }
      return {
        sql: `${base} AND resTrailer.value = ?)`,
        params: [filter.trailer, String(filter.value)],
      };
    }

    case 'statusCode':
      return {
        sql: `${tableNames.responses}.status_code = ?`,
        params: [filter.code],
      };

    case 'statusCodeRange':
      return {
        sql: `(${tableNames.responses}.status_code BETWEEN ? AND ?)`,
        params: [filter.start, filter.end],
      };

    case 'hasBody':
      return { sql: `${tableNames.requests}.body IS NOT NULL`, params: [] };

    case 'hasResponseBody':
      return { sql: `${tableNames.responses}.body IS NOT NULL`, params: [] };

    case 'requestMediaType': {
      const where = `
        EXISTS (
          SELECT 1
          FROM http_request_header reqHeader
          WHERE reqHeader.request_id = req.id
          AND reqHeader.name = 'content-type' COLLATE NOCASE
          AND LOWER(reqHeader.value) LIKE LOWER(?)
        )`;
      return { sql: where, params: [filter.mediaType] };
    }

    case 'responseMediaType': {
      const where = `
        EXISTS (
          SELECT 1
          FROM http_response_header resHeader
          WHERE resHeader.response_id = res.id
          AND resHeader.name = 'content-type' COLLATE NOCASE
          AND LOWER(resHeader.value) LIKE LOWER(?)
        )`;
      return { sql: where, params: [filter.mediaType] };
    }

    case 'constant':
      return { sql: filter.value ? '1=1' : '0=1', params: [] };

    case 'and': {
      const parts = filter.filters.map((expr) =>
        compileHttpFilterToWhereClause(expr, tableNames),
      );
      return {
        sql: parts.map((p) => parenthesize(p.sql)).join(' AND '),
        params: parts.flatMap((p) => p.params),
      };
    }

    case 'or': {
      const parts = filter.filters.map((expr) =>
        compileHttpFilterToWhereClause(expr, tableNames),
      );
      return {
        sql: parts.map((p) => parenthesize(p.sql)).join(' OR '),
        params: parts.flatMap((p) => p.params),
      };
    }

    case 'not': {
      const inner = compileHttpFilterToWhereClause(filter.filter);
      return {
        sql: `NOT ${parenthesize(inner.sql)}`,
        params: inner.params,
      };
    }

    case 'xor': {
      const [a, b] = filter.filters;
      const sa = compileHttpFilterToWhereClause(a);
      const sb = compileHttpFilterToWhereClause(b);
      const where = `
        (${parenthesize(sa.sql)} AND NOT ${parenthesize(sb.sql)})
        OR
        (${parenthesize(sb.sql)} AND NOT ${parenthesize(sa.sql)})
      `;
      return {
        sql: where,
        params: [...sa.params, ...sb.params, ...sb.params, ...sa.params],
      };
    }

    case 'queryParam': {
      if (typeof filter.param === 'undefined') {
        return { sql: '1=1', params: [] };
      }

      return {
        sql: `
          EXISTS (
            SELECT 1
            FROM http_request_query_parameter reqParam
            WHERE
              reqParam.request_id = reqId AND
              reqParam.name = ? COLLATE NOCASE AND
              reqParam.value = ?
          )`,
        params: [filter.param, filter.value],
      };
    }
    case 'url': {
      if (typeof filter.url === 'undefined') {
        return { sql: '1=1', params: [] };
      }

      const url = new URL(filter.url);

      return compileHttpFilterToWhereClause(
        and(origin(url.origin), path(url.pathname)),
        tableNames,
      );
    }
    case 'protocol': {
      if (typeof filter.protocol === 'undefined') {
        return { sql: '1=1', params: [] };
      }

      return {
        sql: `${tableNames.requests}.origin LIKE ? || '://%'`,
        params: [filter.protocol],
      };
    }
    case 'matches-origin': {
      if (typeof filter.origin === 'undefined') {
        return { sql: '1=1', params: [] };
      }

      return {
        sql: `${tableNames.requests}.origin LIKE ?`,
        params: [`%${filter.origin.replaceAll('*', '%')}%`],
      };
    }
    case 'hasResponse':
    case 'isAuthorized':
    case 'port':
      throw new Error(
        `HTTP filter expression "${filter.type}" is not supported for SQL translation.`,
      );
  }
}
