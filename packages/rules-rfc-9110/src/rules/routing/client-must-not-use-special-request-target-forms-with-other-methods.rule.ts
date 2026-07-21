import { constant } from '@thymian/core';
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
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateHttpTransactions(constant(true), (req, _res, location) => {
      const method = req.method.toUpperCase();
      const target = (req.target ?? req.path).trim();

      // Asterisk-form: a request-target of exactly "*" is reserved for OPTIONS.
      if (target === '*' && method !== 'OPTIONS') {
        return [
          {
            location,
            violation: {
              message: `The asterisk-form request target ("*") was used with method ${req.method}.`,
            },
            findings: [],
          },
        ];
      }

      // Authority-form (host:port without path, query or scheme) is reserved
      // for CONNECT.
      if (/^[^/?#]+:\d+$/.test(target) && method !== 'CONNECT') {
        return [
          {
            location,
            violation: {
              message: `The authority-form request target ("${target}") was used with method ${req.method}.`,
            },
            findings: [],
          },
        ];
      }

      return [];
    }),
  )
  .done();
