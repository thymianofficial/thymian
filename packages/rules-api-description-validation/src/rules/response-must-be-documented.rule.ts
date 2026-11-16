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

import {
  type GraphLocation,
  missingElementMessage,
  requestAt,
} from './graph-location.js';

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
        // The location only says where the pair landed; the resolution also
        // says what about an Undocumented Response (ADR-0027) is undocumented.
        const resolution = ctx.format.resolveTransaction(request, response);

        if (resolution.kind === 'matched') {
          return [{ location, findings: [] }];
        }

        if (resolution.kind === 'unknown-operation') {
          return [
            {
              location,
              findings: [
                {
                  title: NAME,
                  kind: 'rule-skip',
                  message: `No matching endpoint found in corresponding API description document.`,
                },
              ],
            },
          ];
        }

        const operationLocation: GraphLocation = {
          elementType: 'node',
          elementId: resolution.requestId,
        };
        const operation = requestAt(ctx.format, operationLocation);

        if (!operation) {
          return [
            {
              location,
              findings: [
                {
                  title: NAME,
                  kind: 'rule-skip',
                  message: missingElementMessage(operationLocation),
                },
              ],
            },
          ];
        }

        const selector = formatRequestSelector(operation);
        const message =
          resolution.undocumented === 'status'
            ? `Response status ${response.statusCode} is not documented for ${selector}. Documented: ${documentedOrNone(resolution.documentedStatuses)}.`
            : `Response media type ${getContentType(response.headers)} is not documented for ${
                resolution.statusCode === 'default'
                  ? 'default'
                  : `status ${resolution.statusCode}`
              } of ${selector}. Documented: ${documentedOrNone(resolution.documentedMediaTypes)}.`;

        return [{ location, violation: { message }, findings: [] }];
      },
    });
  })
  .done();
