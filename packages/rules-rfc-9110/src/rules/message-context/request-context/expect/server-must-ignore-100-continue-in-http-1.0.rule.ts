import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/server-must-ignore-100-continue-in-http-1.0')
  .severity('hint')
  .type(
    'informational',
    'peer-not-observable',
    "Ignoring the expectation is the absence of a behaviour; a conforming server's internal handling of the 100-continue expectation produces no distinguishing wire signal.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A server that receives a 100-continue expectation in an HTTP/1.0 request MUST ignore that expectation.',
  )
  .appliesTo('server')
  .done();
