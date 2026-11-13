import { httpRule, not, responseHeader, statusCode } from '@thymian/core';

export const createdResponsesHaveLocation = httpRule(
  'demo/created-responses-have-location',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .summary(
    'A 201 Created response must name the new resource in a Location header',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions({
      appliesTo: statusCode(201),
      violatedWhen: not(responseHeader('location')),
    }),
  )
  .done();
