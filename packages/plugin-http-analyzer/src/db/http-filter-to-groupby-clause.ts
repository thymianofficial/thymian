import {
  and,
  type HttpFilterExpression,
  type LogicalExpression,
  origin,
  path,
  port,
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
      return httpFilterToGroupByClause(and(origin(), port(), path()), tables);
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
  return visitHttpFilter(expression, {
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
    visitPort(): string {
      return `COALESCE(${tables.requests}.port, '')`;
    },
    visitStatusCode(): string {
      return `COALESCE(${tables.responses}.status_code, '')`;
    },
    visitPath(): string {
      return `COALESCE(${tables.requests}.path, '')`;
    },
  });
}
