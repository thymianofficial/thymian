import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-list-protocols-in-layer-ascending-order',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'If multiple protocol layers are being switched in a 101 (Switching Protocols) response, the sender MUST list the protocols in layer-ascending order. This ensures proper protocol stacking and negotiation.',
  )
  .summary(
    'Server MUST list protocols in layer-ascending order in Upgrade header.',
  )
  .done();
