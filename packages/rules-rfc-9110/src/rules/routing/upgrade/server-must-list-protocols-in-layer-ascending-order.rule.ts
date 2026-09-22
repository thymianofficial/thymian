import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- protocol-stacking correctness, not a concern this vocabulary covers
export default httpRule(
  'rfc9110/server-must-list-protocols-in-layer-ascending-order',
)
  .severity('error')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#121',
    'Ascending layer order is a semantic property of the advertised protocol tokens; Thymian has no registry of protocol layering to rank an arbitrary pair of tokens.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'If multiple protocol layers are being switched in a 101 (Switching Protocols) response, the sender MUST list the protocols in layer-ascending order. This ensures proper protocol stacking and negotiation.',
  )
  .summary(
    'Server MUST list protocols in layer-ascending order in Upgrade header.',
  )
  .done();
