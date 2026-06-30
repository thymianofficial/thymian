import {
  and,
  type CommonHttpRequest,
  type CommonHttpResponse,
  method,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-send-location-header-for-201-response',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-post')
  .summary(
    'Origin server should send 201 (Created) response containing a Location header for the primary created resource.',
  )
  .description(
    'If one or more resources has been created on the origin server as a result of successfully processing a POST request, the origin server SHOULD send a 201 (Created) response containing a Location header field that provides an identifier for the primary resource created and a representation that describes the status of the request while referring to the new resource(s).',
  )
  .appliesTo('origin server')
  .rule((context) =>
    context.validateCommonHttpTransactions(
      and(method('POST'), statusCode(201)),
      (_req: CommonHttpRequest, res: CommonHttpResponse, location) => {
        const hasLocation = res.headers.some(
          (header) => header.toLowerCase() === 'location',
        );

        if (hasLocation) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message:
                'A 201 (Created) response to POST SHOULD include a Location header field identifying the primary resource created, but none is present.',
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
