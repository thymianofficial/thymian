import { httpRule } from '@thymian/core';

// we could test this if we would have access to the raw request
export default httpRule('rfc9110/user-agent-should-send-host-as-first-header')
  .severity('warn')
  // Header ORDERING (Host being the first field) is not preserved by the
  // validation pipeline — the common projection exposes header names via
  // Object.keys and captured/normalized traffic (e.g. HAR, HTTP/2) does not
  // retain original header order — so "first field" is not observable. Kept
  // informational.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-host-and-authority')
  .description(
    'A user agent that sends Host SHOULD send it as the first field in the header section of a request.',
  )
  .appliesTo('user-agent')
  .done();
