import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/proxy-may-transform-content-without-no-transform-directive',
)
  .severity('hint')
  // Informational (outcome 2): transforming content when no `no-transform`
  // directive is present is an explicit permission (MAY) — a proxy is free to
  // transform or not, and (separately) MAY signal a transformation with a 203
  // status. There is no non-conformant condition to detect. The previous
  // implementation walked the trace and flagged transactions where content was
  // unchanged while `no-transform` was absent, which is not a violation of
  // anything (the absence of an allowed transformation is not a defect). It is
  // reclassified to informational. (The complementary MUST NOT —
  // `proxy-must-not-transform-content-with-no-transform-directive` — remains
  // enforced.)
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-message-transformations',
  )
  .description(
    'A proxy MAY transform the content of a message that does not contain a no-transform cache directive. A proxy that transforms the content of a 200 (OK) response can inform downstream recipients that a transformation has been applied by changing the response status code to 203 (Non-Authoritative Information).',
  )
  .summary('Proxy MAY transform content without no-transform directive.')
  .appliesTo('proxy')
  .done();
