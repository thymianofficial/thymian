import {
  constant,
  type HttpRequest,
  type HttpResponse,
  httpRule,
  type HttpTestCaseResult,
  type RuleViolationLocation,
  validateRequestHeaders,
} from '@thymian/core';

import { withStructuredFindings } from './report-utils.js';

export default httpRule('thymian/request-headers-must-conform-to-schema')
  .severity('error')
  .type('analytics')
  .description(
    'Request headers must conform to the API description schema. Checks for missing required headers, additional undocumented headers, and validates existing headers against their schema.',
  )
  .summary('Request headers must conform to the API description schema.')
  .rule(async (ctx) => {
    const findings: HttpTestCaseResult[] = [];

    const result = await ctx.validateHttpTransactions(
      constant(true),
      (
        request: HttpRequest,
        _response: HttpResponse,
        location: RuleViolationLocation,
      ) => {
        if (typeof location === 'string') {
          return false;
        }

        const transaction = ctx.format.getThymianHttpTransactionById(
          location.elementId,
        );

        if (!transaction) {
          return false;
        }

        const results = validateRequestHeaders(
          request.headers ?? {},
          transaction.thymianReq,
        );
        findings.push(...results);
        const failures = results.filter((r) => r.type === 'assertion-failure');

        if (failures.length > 0) {
          return {
            message: `${failures.length} assertion(s) failed`,
          };
        }

        return false;
      },
    );

    return withStructuredFindings(result, findings);
  })
  .done();
