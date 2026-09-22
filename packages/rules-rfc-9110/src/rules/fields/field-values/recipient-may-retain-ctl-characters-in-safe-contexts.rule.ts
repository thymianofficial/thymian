import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/recipient-may-retain-ctl-characters-in-safe-contexts',
)
  .severity('off')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#115',
    'A recipient that declines this rejects the message or replaces the octet before forwarding, while one that takes it up passes the octet through, so the difference shows up as a response status or as an outbound field value. Deciding whether the octet sits in the safe context Section 5.5 names — an application-specific quoted string — needs quoted-string grammar rules cannot parse yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5')
  .description(
    'Field values containing other CTL characters are also invalid; however, recipients MAY retain such characters for the sake of robustness when they appear within a safe context (e.g., an application-specific quoted string that will not be processed by any downstream HTTP parser).',
  )
  .summary(
    'Recipient MAY retain other CTL characters in field values when in safe contexts.',
  )
  .done();
