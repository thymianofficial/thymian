import {
  constant,
  type HttpRequest,
  type HttpResponse,
  httpRule,
  httpTestResultToRuleFindings,
  type RuleFnResult,
  type RuleViolationLocation,
  validateBodyForRequest,
} from '@thymian/core';

export default httpRule('thymian/request-body-must-conform-to-schema')
  .severity('error')
  .type('analytics')
  .description('Request body must conform to the API description schema.')
  .rule(async (ctx) => {
    return ctx.validateHttpTransactions(
      constant(true),
      (
        request: HttpRequest,
        _response: HttpResponse,
        location: RuleViolationLocation,
      ): RuleFnResult[] => {
        if (typeof location === 'string') {
          return [
            {
              location,
              findings: [
                {
                  title: 'thymian/request-body-must-conform-to-schema',
                  kind: 'rule-skip',
                  message: `No matching endpoint found in corresponding API description document.`,
                },
              ],
            },
          ];
        }

        const transaction = ctx.format.getThymianHttpTransactionById(
          location.elementId,
        );

        if (!transaction) {
          return [
            {
              location,
              findings: [
                {
                  title: 'thymian/request-body-must-conform-to-schema',
                  kind: 'rule-skip',
                  message: `Can't find transaction with given ID ${location.elementId} in Thymian format.`,
                },
              ],
            },
          ];
        }

        const results = validateBodyForRequest(
          request.body,
          transaction.thymianReq,
        );
        const failures = results.filter((r) => r.type === 'assertion-failure');

        if (failures.length > 0) {
          // A schema-compilation failure is a defect of the API description
          // document, so it must not be blamed on the observed request body.
          const message = failures.some(
            (failure) =>
              failure.type === 'assertion-failure' &&
              failure.assertion === 'schema-compilation',
          )
            ? 'Request body could not be validated: the schema in the API description document failed to compile'
            : `Request body does not conform to the schema (${failures.length} issue${failures.length === 1 ? '' : 's'})`;

          return [
            {
              location,
              violation: { message },
              findings: httpTestResultToRuleFindings(results),
            },
          ];
        }

        return [{ location, findings: httpTestResultToRuleFindings(results) }];
      },
    );
  })
  .done();
