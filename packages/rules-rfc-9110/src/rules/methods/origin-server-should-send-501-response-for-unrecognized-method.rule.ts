import { httpRule } from '@thymian/core';

// Informational: the SHOULD only applies when the server receives a method
// that is "unrecognized or not implemented". We cannot know which methods a
// deployed server recognizes, and Thymian generates requests from the spec
// (i.e. only methods the API declares), so it never naturally produces an
// unrecognized method to observe the response status for. A HAR likewise will
// not contain a request the server treats as unrecognized in any identifiable
// way. The triggering condition is therefore not observable, so the rule
// ships no function.
export default httpRule(
  'rfc9110/origin-server-should-send-501-response-for-unrecognized-method',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description(
    'An origin server that receives a request method that is unrecognized or not implemented SHOULD respond with the 501 (Not Implemented) status code.',
  )
  .appliesTo('origin server')
  .done();
