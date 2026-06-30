import {
  and,
  type CommonHttpRequest,
  type CommonHttpResponse,
  hasRequestBody,
  httpRule,
  method,
} from '@thymian/core';

export default httpRule(
  'rfc9110/client-must-send-content-type-header-for-content-in-options-request',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-options')
  .description(
    'A client that generates an OPTIONS request containing content MUST send a valid Content-Type header field describing the representation media type.',
  )
  .appliesTo('client', 'user-agent')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('OPTIONS'), hasRequestBody()),
      (req: CommonHttpRequest, _res: CommonHttpResponse, location) => {
        const hasContentType = req.headers.some(
          (header) => header.toLowerCase() === 'content-type',
        );

        if (hasContentType) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message:
                'An OPTIONS request that carries content MUST include a Content-Type header field describing the representation media type, but none is present.',
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
