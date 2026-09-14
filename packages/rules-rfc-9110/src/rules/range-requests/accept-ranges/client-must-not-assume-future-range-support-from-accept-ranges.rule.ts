import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-must-not-assume-future-range-support-from-accept-ranges',
)
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    'Governs an internal assumption the client makes about future behavior. No header, status, or body signal on the wire reveals whether a client assumed future range support.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-ranges')
  .description(
    'A client MUST NOT assume that receiving an Accept-Ranges field means that future range requests will return partial responses. The content might change, the server might only support range requests at certain times or under certain conditions, or a different intermediary might process the next request.',
  )
  .summary(
    'Client must not assume future range support based on Accept-Ranges field as conditions may change.',
  )
  .appliesTo('client')
  .done();
