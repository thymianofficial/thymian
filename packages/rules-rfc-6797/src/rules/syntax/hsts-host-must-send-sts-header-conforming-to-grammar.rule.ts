import { httpRule } from '@thymian/core';

import { stsValueRule } from '../utils/sts-contexts.js';
import { parseStsFieldValue } from '../utils/sts-field-value.js';

const NAME = 'rfc-6797/hsts-host-must-send-sts-header-conforming-to-grammar';

const { lint, live } = stsValueRule(NAME, (fieldValue) => {
  const parsed = parseStsFieldValue(fieldValue);
  return parsed.conforms
    ? undefined
    : `The Strict-Transport-Security value "${fieldValue}" does not conform to the RFC 6797 §6.1 grammar: ${parsed.problem}. A UA MUST ignore a non-conforming STS header field, so no HSTS Policy is in effect.`;
});

export default httpRule(NAME)
  .severity('error')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-7.1')
  .description(
    'An STS header field an HSTS Host includes MUST satisfy the grammar specified in Section 6.1; UAs MUST ignore any STS header field containing directives, or other header field value data, that does not conform to the syntax defined in this specification.',
  )
  .summary(
    'HSTS Host must send a Strict-Transport-Security value that conforms to the RFC 6797 grammar.',
  )
  .explanation(
    'Browsers do not repair a malformed Strict-Transport-Security header: RFC 6797 requires them to ignore it entirely. A comma where a semicolon belongs, or a stray character in a directive, therefore switches HSTS off without any visible error, and the site stays open to protocol downgrade and cookie hijacking while its operators believe it is protected. Directives are separated by ";", each is a token optionally followed by "=" and a token or a quoted string.',
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
