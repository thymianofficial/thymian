import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-must-not-forward-message-to-itself',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-message-forwarding')
  .description(
    'An intermediary MUST NOT forward a message to itself unless it is protected from an infinite request loop. In general, an intermediary ought to recognize its own server names, including any aliases, local variations, or literal IP addresses, and respond to such requests directly.',
  )
  .summary(
    'Intermediary MUST NOT forward message to itself without loop protection.',
  )
  .appliesTo('proxy', 'gateway')
  .done();
