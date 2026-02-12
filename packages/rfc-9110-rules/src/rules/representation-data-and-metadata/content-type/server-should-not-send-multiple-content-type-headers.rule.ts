import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-should-not-send-multiple-content-type-headers',
)
  .severity('error')
  .type('static', 'test', 'analytics')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3')
  .description(
    `Content-Type is defined as a singleton field, meaning it should not be sent multiple times in a single message.
    Although recipients often attempt to handle multiple Content-Type errors by using the last syntactically valid member,
    sending multiple Content-Type headers can cause ambiguity, security issues, and interoperability problems.`,
  )
  .summary(
    'Servers SHOULD NOT send multiple Content-Type headers (singleton field).',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      responseHeader('content-type'),
      (req, res, location) => {
        const contentTypeHeaders = res.headers.filter((h: string) =>
          h.toLowerCase().startsWith('content-type:'),
        );

        if (contentTypeHeaders.length > 1) {
          return {
            message: `Multiple Content-Type headers found (${contentTypeHeaders.length}), which violates singleton field requirement`,
            location,
          };
        }

        return false;
      },
    ),
  )
  .done();
