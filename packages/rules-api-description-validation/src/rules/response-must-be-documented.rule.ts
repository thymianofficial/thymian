import {
  constant,
  formatRequestSelector,
  getContentType,
  type HttpRequest,
  type HttpResponse,
  httpRule,
  type RuleFnResult,
  type RuleViolationLocation,
} from '@thymian/core';

import { requestAt, unknownOperationSkip } from './located-request.js';

const NAME = 'thymian/response-must-be-documented';

function documentedOrNone(values: (string | number)[]): string {
  return values.length > 0 ? values.join(', ') : 'none';
}

// eslint-disable-next-line thymian-internal/require-rule-tags -- conformance check against the API description, not a security or privacy concern
export default httpRule(NAME)
  .severity('error')
  .type('analytics')
  .description(
    'Every recorded response must be documented for its operation in the API description: its status, concretely or by `default`, and its media type.',
  )
  .summary('Response must be documented in the API description.')
  .rule(async (ctx) => {
    return ctx.validateHttpTransactions({
      appliesTo: constant(true),
      violatedWhen: (
        request: HttpRequest,
        response: HttpResponse,
        location: RuleViolationLocation,
      ): RuleFnResult[] => {
        if (typeof location === 'string') {
          return unknownOperationSkip(location, NAME);
        }

        if (location.elementType === 'edge') {
          return [{ location, findings: [] }];
        }

        // A node location is an Undocumented Response (ADR-0026) at its
        // operation; the resolution says what about it is undocumented.
        const resolution = ctx.format.resolveTransaction(request, response);
        const operation = requestAt(ctx.format, location);

        if (resolution.kind !== 'undocumented-response' || !operation) {
          throw new Error(
            `${NAME}: expected an Undocumented Response at an existing request ${location.elementId}.`,
          );
        }

        const selector = formatRequestSelector(operation);
        const message =
          resolution.undocumented === 'status'
            ? `Response status ${response.statusCode} is not documented for ${selector}. Documented: ${documentedOrNone(resolution.documentedStatuses)}.`
            : `Response media type ${getContentType(response.headers, '(none)')} is not documented for ${
                resolution.statusCode === 'default'
                  ? 'default'
                  : `status ${resolution.statusCode}`
              } of ${selector}. Documented: ${documentedOrNone(resolution.documentedMediaTypes)}.`;

        return [{ location, violation: { message }, findings: [] }];
      },
    });
  })
  .done();
