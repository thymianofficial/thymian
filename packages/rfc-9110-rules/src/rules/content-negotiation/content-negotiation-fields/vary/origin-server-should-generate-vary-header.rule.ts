import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/origin-server-should-generate-vary-header')
  .severity('warn')
  .type('static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-vary')
  .description(
    "An origin server SHOULD generate a Vary header field on a cacheable response when it wishes that response to be selectively reused for subsequent requests. Generally, that is the case when the response content has been tailored to better fit the preferences expressed by those selecting header fields, such as when an origin server has selected the response's language based on the request's Accept-Language header field.",
  )
  .summary(
    'An origin server SHOULD generate a Vary header field on a cacheable response when it wishes that response to be selectively reused for subsequent requests.',
  )
  .appliesTo('origin server')
  .done();
