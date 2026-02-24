import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/recipient-should-process-higher-minor-version-as-highest-known',
)
  .severity('hint')
  .type('informational')
  .appliesTo('client', 'server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.2')
  .description(
    'A recipient that receives a message with a major version number that it implements and a minor version number higher than what it implements SHOULD process the message as if it were in the highest minor version within that major version to which the recipient is conformant. A recipient can assume that a message with a higher minor version, when sent to a recipient that has not yet indicated support for that higher version, is sufficiently backwards-compatible to be safely processed by any implementation of the same major version.',
  )
  .summary(
    'Recipients SHOULD process messages with higher minor versions as highest known minor version.',
  )
  .done();
