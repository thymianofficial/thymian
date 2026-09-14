import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/recipient-must-interpret-two-digit-years-correctly',
)
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    'How a recipient interprets an rfc850 two-digit year is an internal decision that produces no distinguishable artifact in the traffic Thymian can observe.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7')
  .description(
    'Recipients of a timestamp value in rfc850-date format, which uses a two-digit year, MUST interpret a timestamp that appears to be more than 50 years in the future as representing the most recent year in the past that had the same last two digits.',
  )
  .summary(
    'Recipient MUST interpret two-digit years >50 years in the future as representing the past.',
  )
  .done();
