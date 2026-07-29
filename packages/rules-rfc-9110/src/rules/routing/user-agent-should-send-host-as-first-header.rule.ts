import { httpRule } from '@thymian/core';

// we could test this if we would have access to the raw request
export default httpRule('rfc9110/user-agent-should-send-host-as-first-header')
  .severity('warn')
  // Header ordering is normalized away before Thymian sees the message, so first-header position cannot be reliably validated.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-host-and-authority')
  .description(
    'A user agent that sends Host SHOULD send it as the first field in the header section of a request.',
  )
  .appliesTo('user-agent')
  .done();
