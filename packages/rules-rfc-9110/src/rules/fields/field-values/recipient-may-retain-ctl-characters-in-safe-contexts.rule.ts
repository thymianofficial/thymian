import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-may-retain-ctl-characters-in-safe-contexts',
)
  .severity('off')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5')
  .description(
    'Field values containing other CTL characters are also invalid; however, recipients MAY retain such characters for the sake of robustness when they appear within a safe context (e.g., an application-specific quoted string that will not be processed by any downstream HTTP parser).',
  )
  .summary(
    'Recipient MAY retain other CTL characters in field values when in safe contexts.',
  )
  .done();
