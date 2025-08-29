import type { HttpFilterExpression } from '@thymian/http-filter';

import type { SqlFragment } from '../utils.js';
import { compileHttpFilterToWhereClause } from './http-filter-to-where-clause.js';

export function httpFilterToCommonFilter(
  filter: HttpFilterExpression
): SqlFragment {
  const { sql, params } = compileHttpFilterToWhereClause(filter, {
    requests: 'req',
    responses: 'res',
  });

  const statement = `
      SELECT 
        t.id AS id
      FROM http_transaction t
      JOIN http_request req ON req.id = t.request_id
      JOIN http_response res ON res.id = t.response_id
      WHERE 
        ${sql}
    `;

  return {
    sql: statement,
    params,
  };
}
