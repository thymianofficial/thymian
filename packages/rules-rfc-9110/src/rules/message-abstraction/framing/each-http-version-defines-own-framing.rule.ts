import { httpRule } from '@thymian/core';

// A purely definitional statement (each HTTP version defines its own framing
// mechanism). It states no requirement on any message, so there is nothing to
// validate.
export default httpRule('rfc9110/each-http-version-defines-own-framing')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.1')
  .description(
    'Message framing indicates how each message begins and ends, such that each message can be distinguished from other messages or noise on the same connection. Each major version of HTTP defines its own framing mechanism.',
  )
  .summary('Each HTTP version defines its own message framing mechanism.')
  .done();
