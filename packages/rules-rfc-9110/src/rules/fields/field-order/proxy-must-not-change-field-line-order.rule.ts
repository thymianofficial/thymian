import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-not-change-field-line-order')
  .severity('error')
  // Infrastructure-deferred (outcome 3): this MUST governs how a proxy forwards
  // repeated same-name field lines. Detecting a violation requires comparing
  // the order of those field-line values as received by the proxy with the
  // order it emits when forwarding — a before/after-the-proxy comparison that
  // is not reconstructable from a single captured transaction (and HTTP
  // libraries typically collapse repeated field lines into one parsed value,
  // discarding ordering). It is observable only from traffic recorded at the
  // proxy that preserves both legs and the per-line order, so the rule stays
  // typed `analytics` and scoped to the `proxy` role rather than being
  // downgraded to informational.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.3')
  .description(
    'The order in which field lines with the same name are received is therefore significant to the interpretation of the field value; a proxy MUST NOT change the order of these field line values when forwarding a message.',
  )
  .summary(
    'Proxy MUST NOT change the order of field line values when forwarding.',
  )
  .appliesTo('proxy')
  .done();
