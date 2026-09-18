import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/http-component-may-perform-normalization')
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'An intermediary that takes this up forwards a request-target that differs from the one it received — host lowercased, a default port dropped, %7E decoded to ~ — and a captured trace carries both messages with the role each was seen in. The hint, that a hop normalized the target or passed an unnormalized one straight through, is not written yet.',
  )
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-normalization-and-comparison',
  )
  .description(`Any HTTP component MAY perform normalization.`)
  .done();
