import { equalsIgnoreCase } from '@thymian/core';
import { and, method, or, statusCode, url } from '@thymian/http-filter';
import { httpRule, type RuleViolation } from '@thymian/http-linter';

import { arrayDifference, createList } from '../../../../utils.js';

export default httpRule(
  'rfc9110/server-should-send-same-header-fields-in-response-to-head',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-head')
  .description(
    'The server SHOULD send the same header fields in response to a HEAD request as it would have sent if the request method had been GET.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions(
      and(statusCode(200), or(method('GET'), method('HEAD'))),
      url(),
      (_, transactions) => {
        const getTransaction = transactions.find(([req]) =>
          equalsIgnoreCase(req.method, 'get'),
        );

        const headTransaction = transactions.find(([req]) =>
          equalsIgnoreCase(req.method, 'head'),
        );

        if (
          !getTransaction ||
          !headTransaction ||
          !getTransaction[1] ||
          !headTransaction[1]
        ) {
          return undefined;
        }

        const difference = arrayDifference(
          getTransaction[1].headers,
          headTransaction[1].headers,
        );

        if (difference.length === 0) {
          return undefined;
        }

        return {
          location: {
            elementId: headTransaction[1].id,
            elementType: 'node',
          },
          message: `Response to HEAD request is missing headers: ${createList(
            difference,
          )}`,
        } satisfies RuleViolation;
      },
    ),
  )
  .done();
