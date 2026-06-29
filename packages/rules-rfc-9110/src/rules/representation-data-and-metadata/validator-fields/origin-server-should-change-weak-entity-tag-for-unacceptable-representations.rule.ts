import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-change-weak-entity-tag-for-unacceptable-representations',
)
  .severity('off')
  // Informational (outcome 2): this SHOULD asks the server to bump a weak entity
  // tag whenever it decides prior representations are no longer acceptable
  // substitutes. Detecting a violation would require observing the same resource
  // over time, knowing the server CONSIDERS the old representation unacceptable
  // (server-internal intent), and confirming the weak tag did not change — none
  // of which the framework can observe from one transaction. No observable
  // non-conformant condition.
  .type('informational')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.1')
  .description(
    `An origin server SHOULD change a weak entity tag whenever it considers prior representations to be unacceptable
    as a substitute for the current representation. In other words, a weak entity tag ought to change whenever the
    origin server wants caches to invalidate old responses.`,
  )
  .summary(
    'Origin servers SHOULD change weak entity tags when prior representations are unacceptable.',
  )
  .done();
