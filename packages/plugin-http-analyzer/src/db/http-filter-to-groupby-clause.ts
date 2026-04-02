import {
  and,
  type HttpFilterExpression,
  type LogicalExpression,
  origin,
  path,
  visitHttpFilter,
} from '@thymian/core';

import type { TableNames } from './types.js';
import type { SqlFragment } from './utils.js';

export function httpFilterToGroupByClause(
  expression: HttpFilterExpression,
  tables: TableNames,
): SqlFragment {
  const params: unknown[] = [];

  switch (expression.type) {
    case 'url':
      // port is embedded in origin (e.g. "https://example.com:8080"), so
      // grouping by origin + path is sufficient to identify a URL.
      return httpFilterToGroupByClause(and(origin(), path()), tables);
    case 'origin':
      return {
        sql: `${tables.requests}.origin`,
        params,
      };
    case 'port':
      return {
        sql: `${tables.requests}.port`,
        params,
      };
    case 'method':
      return {
        sql: `${tables.requests}.method`,
        params,
      };
    case 'path':
      return {
        sql: `${tables.requests}.path`,
        params,
      };
    case 'statusCode':
      return {
        sql: `${tables.responses}.status_code`,
        params,
      };
    case 'and': {
      const parts = expression.filters.map((expr) =>
        httpFilterToGroupByClause(expr, tables),
      );

      return {
        sql: parts.map((p) => p.sql).join(', '),
        params,
      };
    }
    default:
      throw new Error(`Unsupported group by expression: ${expression.type}`);
  }
}

export function httpFilterToGroupingKey(
  expression: HttpFilterExpression,
  tables: TableNames,
): string {
  // Pre-expand url() to and(origin(), path()) so the visitor does not need a
  // visitUrl handler (port is already embedded in origin).
  const resolved =
    expression.type === 'url' ? and(origin(), path()) : expression;

  return visitHttpFilter(resolved, {
    visitAnd(expr: Extract<LogicalExpression, { type: 'and' }>): string {
      return expr.filters
        .map((filter) => httpFilterToGroupingKey(filter, tables))
        .join(' || ');
    },
    visitOrigin(): string {
      return `COALESCE(${tables.requests}.origin, '')`;
    },
    visitMethod(): string {
      return `COALESCE(${tables.requests}.method, '')`;
    },
    visitStatusCode(): string {
      return `COALESCE(${tables.responses}.status_code, '')`;
    },
    visitPath(): string {
      return `COALESCE(${tables.requests}.path, '')`;
    },
  });
}
