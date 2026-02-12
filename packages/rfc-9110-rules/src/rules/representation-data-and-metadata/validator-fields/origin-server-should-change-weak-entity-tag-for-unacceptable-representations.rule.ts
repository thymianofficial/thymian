import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-should-change-weak-entity-tag-for-unacceptable-representations',
)
  .severity('off')
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
