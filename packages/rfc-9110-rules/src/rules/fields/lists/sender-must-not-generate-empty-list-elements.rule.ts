import { httpRule } from '@thymian/http-linter';

// TODO: Implement ABNF validation for #rule list syntax
// Requires parsing #rule lists and detecting empty elements:
//   1#element => element *( OWS "," OWS element )
// Can be implemented in static context to validate outgoing messages
export default httpRule('rfc9110/sender-must-not-generate-empty-list-elements')
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.1')
  .description(
    'In any production that uses the list construct, a sender MUST NOT generate empty list elements.',
  )
  .summary('Sender MUST NOT generate empty list elements.')
  .appliesTo('client', 'server')
  .tags('fields', 'lists')
  .done();
