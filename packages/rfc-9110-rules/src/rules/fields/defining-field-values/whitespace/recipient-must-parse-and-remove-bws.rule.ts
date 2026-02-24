import { httpRule } from '@thymian/http-linter';

// TODO: Implement ABNF validation for BWS parsing and removal
// Requires detecting and removing BWS before processing:
//   BWS = OWS ; "bad" whitespace
export default httpRule('rfc9110/recipient-must-parse-and-remove-bws')
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'A recipient MUST parse for such bad whitespace and remove it before interpreting the protocol element.',
  )
  .summary(
    'Recipient MUST parse for and remove bad whitespace (BWS) before interpretation.',
  )
  .appliesTo('client', 'server', 'proxy', 'intermediary')
  .tags('fields', 'whitespace', 'parsing')
  .done();
