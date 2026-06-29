import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-send-100-before-101-with-expect-header',
)
  .severity('error')
  // Constrains the ordering of interim (1xx) responses: a 100 (Continue) must
  // precede a 101 (Switching Protocols). Interim 1xx responses are not retained
  // as distinct transactions by the test harness or in typical HAR captures, so
  // the relative ordering of the two interim responses is not observable.
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
