import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/protection-space-cannot-extend-beyond-origin')
  .severity('error')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-establishing-a-protection-s',
  )
  .description(
    'Unless specifically allowed by the authentication scheme, a single protection space cannot extend outside the scope of its server.',
  )
  .appliesTo('server')
  .done();
