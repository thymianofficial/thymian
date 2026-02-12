import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/content-language-describes-natural-languages')
  .severity('off')
  .type('informational')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5')
  .description(
    `The "Content-Language" header field describes the natural language(s) of the intended audience for the representation.
    If no Content-Language is specified, the default is that the content is intended for all language audiences.`,
  )
  .summary(
    'Content-Language describes the natural language(s) of the intended audience.',
  )
  .done();
