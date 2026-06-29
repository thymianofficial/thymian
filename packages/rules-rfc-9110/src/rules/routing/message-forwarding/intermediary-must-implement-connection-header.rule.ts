import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/intermediary-must-implement-connection-header')
  .severity('error')
  // OUTCOME 2 (informational): this is an internal *implementation* requirement
  // (the intermediary must implement the Connection header field and exclude
  // incoming-connection-only fields from forwarding). Whether an intermediary
  // "implements" the field is an internal capability, not a single observable
  // signal in a captured message, so it cannot be validated by any context.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-message-forwarding')
  .description(
    'An intermediary not acting as a tunnel MUST implement the Connection header field, as specified in Section 7.6.1, and exclude fields from being forwarded that are only intended for the incoming connection. This ensures proper hop-by-hop header handling.',
  )
  .summary('Intermediary MUST implement Connection header field.')
  .appliesTo('proxy', 'gateway')
  .done();
