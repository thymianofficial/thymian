import {
  httpRule,
  not,
  responseMediaType,
  statusCodeRange,
} from '@thymian/core';

export const clientErrorsAreProblemJson = httpRule(
  'demo/client-errors-are-problem-json',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .summary('A 4xx response must answer as application/problem+json')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions({
      appliesTo: statusCodeRange(400, 499),
      violatedWhen: not(responseMediaType('application/problem+json')),
    }),
  )
  .done();
