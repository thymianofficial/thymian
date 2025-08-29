export type SqlFragment = {
  sql: string;
  params: unknown[];
};

export const parenthesize = (expr: string): string => `(${expr})`;

/*
export function compileHttpFilterToWhereClause(
  filter: HttpFilterExpression
): SqlFragment {
  if (filter.type === 'origin') {
    return { where: 'origin = ?', params: [filter.origin] };
  } else if (filter.type === 'method') {
    return { where: 'method = ? COLLATE NOCASE', params: [filter.method] };
  } else if (filter.type === 'path') {
    return { where: 'path = ?', params: [filter.path] };
  } else if (filter.type === 'requestHeader') {
    {
      const base =
        'EXISTS (SELECT 1 FROM http_request_header reqHeader WHERE reqHeader.request_id = req.id AND reqHeader.name = ? COLLATE NOCASE';
      if (typeof filter.value === 'undefined') {
        return { where: `${base})`, params: [filter.header] };
      }
      return {
        where: `${base} AND reqHeader.value = ?)`,
        params: [filter.header, String(filter.value)],
      };
    }
  } else if (filter.type === 'responseHeader') {
    {
      const base =
        'EXISTS (SELECT 1 FROM http_response_header resHeader WHERE resHeader.response_id = res.id AND resHeader.name = ? COLLATE NOCASE';
      if (typeof filter.value === 'undefined') {
        return { where: `${base})`, params: [filter.header] };
      }
      return {
        where: `${base} AND resHeader.value = ?)`,
        params: [filter.header, String(filter.value)],
      };
    }
  } else if (filter.type === 'responseTrailer') {
    {
      const base =
        'EXISTS (SELECT 1 FROM http_response_trailer resTrailer WHERE resTrailer.response_id = res.id AND resTrailer.name = ? COLLATE NOCASE';
      if (typeof filter.value === 'undefined') {
        return { where: `${base})`, params: [filter.trailer] };
      }
      return {
        where: `${base} AND resTrailer.value = ?)`,
        params: [filter.trailer, String(filter.value)],
      };
    }
  } else if (filter.type === 'statusCode') {
    return { where: 'statusCode = ?', params: [filter.code] };
  } else if (filter.type === 'statusCodeRange') {
    return {
      where: '(statusCode BETWEEN ? AND ?)',
      params: [filter.start, filter.end],
    };
  } else if (filter.type === 'hasBody') {
    // alias from RequestFilterExpression
    return { where: 'reqBody IS NOT NULL', params: [] };
  } else if (filter.type === 'hasResponseBody') {
    return { where: 'resBody IS NOT NULL', params: [] };
  } else if (filter.type === 'requestMediaType') {
    {
      const where =
        'EXISTS (SELECT 1 FROM http_request_header reqHeader WHERE reqHeader.request_id = req.id AND reqHeader.name = "content-type" COLLATE NOCASE AND LOWER(hr.value) LIKE LOWER(? || "%"))';
      return { where, params: [filter.mediaType] };
    }
  } else if (filter.type === 'responseMediaType') {
    {
      const where =
        'EXISTS (SELECT 1 FROM http_response_header resHeader WHERE resHeader.response_id = res.id AND resHeader.name = "content-type" COLLATE NOCASE AND LOWER(hs.value) LIKE LOWER(? || "%"))';
      return { where, params: [filter.mediaType] };
    }
  } else if (filter.type === 'constant') {
    return { where: filter.value ? '1=1' : '0=1', params: [] };
  } else if (filter.type === 'and') {
    {
      const parts = filter.filters.map(compileHttpFilterToWhereClause);
      return {
        where: parts.map((p) => parenthesize(p.where)).join(' AND '),
        params: parts.flatMap((p) => p.params),
      };
    }
  } else if (filter.type === 'or') {
    {
      const parts = filter.filters.map(compileHttpFilterToWhereClause);
      return {
        where: parts.map((p) => parenthesize(p.where)).join(' OR '),
        params: parts.flatMap((p) => p.params),
      };
    }
  } else if (filter.type === 'not') {
    {
      const inner = compileHttpFilterToWhereClause(filter.filter);
      return {
        where: `NOT ${parenthesize(inner.where)}`,
        params: inner.params,
      };
    }
  } else if (filter.type === 'xor') {
    {
      const [a, b] = filter.filters;
      const sa = compileHttpFilterToWhereClause(a);
      const sb = compileHttpFilterToWhereClause(b);
      const where = `(${parenthesize(sa.where)} AND NOT ${parenthesize(
        sb.where
      )}) OR (${parenthesize(sb.where)} AND NOT ${parenthesize(sa.where)})`;
      return {
        where,
        params: [...sa.params, ...sb.params, ...sb.params, ...sa.params],
      };
    }
  } else if (filter.type === 'queryParam') {
    {
      if (typeof filter.param === 'undefined') {
        return { where: '1=1', params: [] };
      }

      return {
        where: `
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
  } else if (
    filter.type === 'hasResponse' ||
    filter.type === 'isAuthorized' ||
    filter.type === 'port'
  ) {
    throw new Error(
      `HTTP filter expression "${filter.type}" is not supported for SQL translation.`
    );
  }
}

 */
