import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/request-content-purpose-defined-by-method')
  .severity('hint')
  .type('informational')
  .appliesTo('client', 'server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.4.1')
  .description(
    'The purpose of content in a request is defined by the method semantics. For example, a representation in the content of a PUT request represents the desired state of the target resource after the request is successfully applied, whereas a representation in the content of a POST request represents information to be processed by the target resource.',
  )
  .summary('Request content purpose is defined by the method semantics.')
  .done();
