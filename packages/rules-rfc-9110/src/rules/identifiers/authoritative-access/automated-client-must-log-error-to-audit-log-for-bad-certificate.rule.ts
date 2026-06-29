import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/automated-client-must-log-error-to-audit-log-for-bad-certificate',
)
  .severity('error')
  // Informational (outcome 2): this MUST governs an automated client's internal
  // side effect — writing to an audit log when certificate verification fails.
  // Whether a client logged the error is not observable from any HTTP request or
  // response, nor from recorded traffic (HAR). No transaction-level condition
  // signals conformance or violation, so no lint/test/analyze function can
  // meaningfully run. Kept as documentation of the requirement.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verificat',
  )
  .description(
    'Automated clients MUST log the error to an appropriate audit log (if available).',
  )
  .appliesTo('client')
  .done();
