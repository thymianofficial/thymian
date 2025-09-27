import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-should-not-rely-on-private-agreements-for-head-requests',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-get')
  .description(
    'An origin server SHOULD NOT rely on private agreements to receive content, since participants in HTTP communication are often unaware of intermediaries along the request chain.',
  )
  .appliesTo('origin server')
  .done();
