import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-must-generate-content-range-header-in-corresponding-body-part-for-206-response',
)
  .severity('error')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#112',
    'Concerns headers inside each multipart body part. The common projection and live HttpResponse expose only top-level header names, not per-part MIME headers, so this cannot be validated with the existing framework.',
  )
  .description(
    'Within the header area of each body part in the multipart content, the server MUST generate a Content-Range header field corresponding to the range being enclosed in that body part.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-multiple-parts')
  .appliesTo('server')
  .done();
