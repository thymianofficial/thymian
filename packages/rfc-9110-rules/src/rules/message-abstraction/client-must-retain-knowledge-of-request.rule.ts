import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/client-must-retain-knowledge-of-request')
  .severity('error')
  .type('informational')
  .appliesTo('client')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-message-abstraction')
  .description(
    'Messages are intended to be "self-descriptive": everything a recipient needs to know about the message can be determined by looking at the message itself, after decoding or reconstituting parts that have been compressed or elided in transit, without requiring an understanding of the sender\'s current application state (established via prior messages). However, a client MUST retain knowledge of the request when parsing, interpreting, or caching a corresponding response. For example, responses to the HEAD method look just like the beginning of a response to GET but cannot be parsed in the same manner.',
  )
  .summary(
    'A client MUST retain knowledge of the request when parsing, interpreting, or caching a corresponding response.',
  )
  .done();
