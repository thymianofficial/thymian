import type { HttpFilterExpression } from '@thymian/http-filter';

import type { SqlFragment } from '../utils.js';
import { httpFilterToGroupByClause } from './http-filter-to-groupby-clause.js';
import { compileHttpFilterToWhereClause } from './http-filter-to-where-clause.js';

export function httpFilterToGroupedCommonFilter(
  filter: HttpFilterExpression,
  groupBy: HttpFilterExpression
): SqlFragment {
  const filterFragment = compileHttpFilterToWhereClause(filter, {
    requests: 'req',
    responses: 'res',
  });
  const groupByFragment = httpFilterToGroupByClause(groupBy, {
    requests: 'req',
    responses: 'res',
  });

  const statement = `
      SELECT GROUP_CONCAT(t.id, ',') AS transactionIds
      FROM http_transaction t
      JOIN http_request req ON req.id = t.request_id
      JOIN http_response res ON res.id = t.response_id
      WHERE 
        ${filterFragment.sql}
      GROUP BY ${groupByFragment.sql}
    `;

  return {
    sql: statement,
    params: filterFragment.params.concat(groupByFragment.params),
  };
}
