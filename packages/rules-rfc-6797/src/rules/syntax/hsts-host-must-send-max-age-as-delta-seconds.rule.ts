import { httpRule } from '@thymian/core';

import { onConformingValue, stsValueRule } from '../utils/sts-contexts.js';
import { findDirectives, isDeltaSeconds } from '../utils/sts-field-value.js';

const NAME = 'rfc-6797/hsts-host-must-send-max-age-as-delta-seconds';

const { lint, live } = stsValueRule(
  NAME,
  onConformingValue((directives, fieldValue) => {
    const problems = findDirectives(directives, 'max-age')
      .filter(({ value }) => !isDeltaSeconds(value))
      .map(({ value }) =>
        value === undefined
          ? 'max-age carries no value'
          : `max-age="${value}" is not a whole number of seconds`,
      );

    return problems.length === 0
      ? undefined
      : `In the Strict-Transport-Security value "${fieldValue}", ${problems.join(' and ')}. max-age's REQUIRED value is delta-seconds (1*DIGIT), and a UA ignores an STS header field whose value is not.`;
  }),
);

export default httpRule(NAME)
  .severity('error')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-6.1.1')
  .description(
    "The syntax of the max-age directive's REQUIRED value (after quoted-string unescaping, if necessary) is defined as: max-age-value = delta-seconds, where delta-seconds = 1*DIGIT.",
  )
  .summary('HSTS Host must send max-age as a whole number of seconds.')
  .explanation(
    'max-age counts seconds, written as digits only: "31536000" or, quoted, "\\"31536000\\"". A sign, a decimal point, a unit such as "1y", or a missing value makes the whole header non-conformant, and a browser ignores it — so the policy the operator meant to set never takes effect.',
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
