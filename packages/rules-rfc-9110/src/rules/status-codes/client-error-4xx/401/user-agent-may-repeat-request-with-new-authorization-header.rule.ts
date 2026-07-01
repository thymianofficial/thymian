import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-may-repeat-request-with-new-authorization-header',
)
  .severity('hint')
  // Permissive MAY describing an internal user-agent retry decision (whether
  // to repeat a 401 with new/replaced credentials). There is no non-conformant
  // condition to observe: retrying is optional and not retrying is equally
  // valid. The previous classification declared `analytics` but shipped no
  // rule function (a silent no-op). Reclassified to `informational`.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-401-unauthorized')
  .summary(
    'The user agent MAY repeat the request with a new or replaced Authorization header field.',
  )
  .description(
    'If the request included authentication credentials, then the 401 response indicates that authorization has been refused for those credentials. The user agent MAY repeat the request with a new or replaced Authorization header field. ',
  )
  .appliesTo('user-agent')
  .done();
