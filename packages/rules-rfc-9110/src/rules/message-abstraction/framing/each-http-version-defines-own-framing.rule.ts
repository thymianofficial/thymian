import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/each-http-version-defines-own-framing')
  .severity('hint')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    'A purely definitional statement (each HTTP version defines its own framing mechanism); it states no requirement on any message.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.1')
  .description(
    'Message framing indicates how each message begins and ends, such that each message can be distinguished from other messages or noise on the same connection. Each major version of HTTP defines its own framing mechanism.',
  )
  .summary('Each HTTP version defines its own message framing mechanism.')
  .done();
