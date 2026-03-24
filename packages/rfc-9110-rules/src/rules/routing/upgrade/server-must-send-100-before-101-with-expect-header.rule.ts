import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-send-100-before-101-with-expect-header',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'If a server receives both an Upgrade and an Expect header field with the "100-continue" expectation, the server MUST send a 100 (Continue) response before sending a 101 (Switching Protocols) response. This ensures proper handling of the expect-continue mechanism before protocol switching.',
  )
  .summary(
    'Server MUST send 100 response before 101 when Expect: 100-continue is present.',
  )
  .appliesTo('server')
  .done();
