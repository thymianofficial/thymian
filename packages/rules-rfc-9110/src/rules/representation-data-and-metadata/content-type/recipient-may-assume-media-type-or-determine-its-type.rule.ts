import {
  and,
  hasRequestBody,
  hasResponseBody,
  not,
  or,
  requestHeader,
  responseHeader,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-may-assume-media-type-or-determine-its-type',
)
  .severity('warn')
  .type('analytics')
  .appliesTo('client', 'user-agent')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3')
  .description(
    `If a Content-Type header field is not present, the recipient MAY either assume a media type of "application/octet-stream" ([RFC2046], Section 4.5.1) or examine the data to determine its type.`,
  )
  .summary(
    'When Content-Type is absent, a recipient MAY assume application/octet-stream or sniff the body.',
  )
  .explanation(
    'If a message has a body but no Content-Type header, the recipient is allowed to either treat it as generic binary data (application/octet-stream) or inspect the bytes to guess the type. It matters because the sender should really declare the type; relying on the recipient to sniff it is a fallback that can guess wrong and, as the RFC warns, mis-sniffing can create security risks such as privilege escalation, so this flags the missing header rather than the recipient behavior.',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      or(hasRequestBody(), hasResponseBody()),
      or(
        and(hasRequestBody(), not(requestHeader('content-type'))),
        and(hasResponseBody(), not(responseHeader('content-type'))),
      ),
    ),
  )
  .done();
