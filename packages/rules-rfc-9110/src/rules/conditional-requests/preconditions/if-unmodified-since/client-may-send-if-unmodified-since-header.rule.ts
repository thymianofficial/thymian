import { and, method, not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/client-may-send-if-unmodified-since-header')
  .severity('hint')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'A client MAY send an If-Unmodified-Since header field in a GET request to indicate that it would prefer a 412 (Precondition Failed) response if the selected representation has been modified. However, this is only useful in range requests (Section 14) for completing a previously received partial representation when there is no desire for a new representation. If-Range (Section 13.1.5) is better suited for range requests when the client prefers to receive a new representation.',
  )
  .summary(
    'A client MAY send an If-Unmodified-Since header field in a GET request.',
  )
  .explanation(
    "A client is permitted to add If-Unmodified-Since to a GET to say 'only give me this if it hasn't changed since this date; otherwise fail with 412'. In practice this is only genuinely useful for range requests, where the client wants to complete a partial copy and does not want a fresh, different representation. For that resume-a-download case If-Range is usually the better fit, since it fetches the whole current copy instead of failing outright when the resource has moved on.",
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('GET'), not(requestHeader('if-unmodified-since'))),
    ),
  )
  .done();
