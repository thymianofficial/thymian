import { method } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-must-not-use-special-request-target-forms-with-other-methods',
)
  .severity('error')
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-determining-the-target-reso',
  )
  .description(
    'The special request target forms (host:port for CONNECT, single asterisk for OPTIONS) MUST NOT be used with other methods. For CONNECT, the request target is the host name and port number of the tunnel destination, separated by a colon. For OPTIONS, the request target can be a single asterisk ("*"). These forms MUST NOT be used with other methods.',
  )
  .summary(
    'Special request target forms MUST NOT be used with methods other than CONNECT or OPTIONS.',
  )
  .appliesTo('client', 'user-agent')
  .rule((ctx) =>
    ctx.validateHttpTransactions(method(), (req, _res, location) => {
      // Asterisk-form: a request-target of exactly "*" (optionally as a bare
      // path) is reserved for OPTIONS.
      const target = req.path.trim();
      const isAsteriskForm = target === '*';

      if (isAsteriskForm && req.method.toUpperCase() !== 'OPTIONS') {
        return [
          {
            location,
            violation: {
              message: `The asterisk-form request target ("*") was used with method ${req.method}. The "*" target is reserved for OPTIONS; it MUST NOT be used with other methods.`,
            },
            findings: [],
          },
        ];
      }

      return [];
    }),
  )
  .done();
