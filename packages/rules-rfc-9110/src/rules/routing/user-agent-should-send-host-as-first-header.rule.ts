import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- legacy-server compatibility ordering, not a concern this vocabulary covers
export default httpRule('rfc9110/user-agent-should-send-host-as-first-header')
  .severity('warn')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#120',
    'Header field order is normalized away before Thymian sees the message — we could test this if we had access to the raw request — so first-header position cannot be validated today.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-host-and-authority')
  .description(
    'A user agent that sends Host SHOULD send it as the first field in the header section of a request.',
  )
  .appliesTo('user-agent')
  .done();
