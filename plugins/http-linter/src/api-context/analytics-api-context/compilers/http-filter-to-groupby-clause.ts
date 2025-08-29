import type { HttpFilterExpression } from '@thymian/http-filter';

import type { SqlFragment } from '../utils.js';
import type { TableNames } from './types.js';

export function httpFilterToGroupByClause(
  expression: HttpFilterExpression,
  tables: TableNames
): SqlFragment {
  const params: unknown[] = [];

  switch (expression.type) {
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
        httpFilterToGroupByClause(expr, tables)
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
