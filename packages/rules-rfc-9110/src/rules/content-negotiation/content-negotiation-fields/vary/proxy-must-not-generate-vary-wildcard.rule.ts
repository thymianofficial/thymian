import {
  getHeader,
  responseHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-not-generate-vary-wildcard')
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-vary')
  .description(
    'A list containing the member "*" signals that other aspects of the request might have played a role in selecting the response representation, possibly including aspects outside the message syntax (e.g., the client\'s network address). A recipient will not be able to determine whether this response is appropriate for a later request without forwarding the request to the origin server. A proxy MUST NOT generate "*" in a Vary field value.',
  )
  .summary('A proxy MUST NOT generate "*" in a Vary field value.')
  .explanation(
    'A Vary value of * means the response depends on factors beyond the request headers, possibly things not even visible in the message, so no cache can decide on its own whether a stored copy fits a later request without asking the origin server. A proxy must never introduce this * into a Vary header. Doing so would effectively make the response uncacheable for downstream caches and could misrepresent how the origin actually selected the response, degrading cache behavior.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      responseHeader('vary'),
      (_req, res, location: RuleViolationLocation) => {
        const varyHeader = getHeader(res.headers, 'vary');

        if (!varyHeader) {
          return [];
        }

        const varyValues = Array.isArray(varyHeader)
          ? varyHeader
          : [varyHeader];

        const isViolation = varyValues
          .flatMap((v) => v.split(','))
          .includes('*');
        return isViolation ? [{ location, violation: {}, findings: [] }] : [];
      },
    ),
  )
  .done();
