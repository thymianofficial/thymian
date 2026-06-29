import {
  and,
  type CommonHttpRequest,
  type CommonHttpResponse,
  method,
  not,
  or,
  responseHeader,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

function hasHeader(headers: string[], name: string): boolean {
  return headers.some((header) => header.toLowerCase() === name);
}

export default httpRule(
  'rfc9110/server-must-ignore-range-header-for-unrecognized-method',
)
  .severity('error')
  // Implementable (outcome 1): observable from a single transaction using only
  // the common projection (header NAMES + status code), so the check is
  // identical in `lint` (validates the described response shapes) and `analyze`
  // (validates recorded traffic). The violation is server-side evidence that a
  // non-GET request's Range was NOT ignored: a 206 (Partial Content) status or
  // a Content-Range response header on a method other than GET. Merely
  // receiving a Range/If-Range request header on a non-GET is conformant
  // (the server is allowed — indeed required — to ignore it), so those are not
  // flagged. The `static,analytics` union resolves to the base ApiContext,
  // which exposes only validateCommonHttpTransactions. Header name matched
  // case-insensitively.
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'A server MUST ignore a Range header field received with a request method that is unrecognized or for which range handling is not defined. For this specification, GET is the only method for which range handling is defined.',
  )
  .summary(
    'A server must ignore a Range header field received with a method (other than GET) for which range handling is not defined.',
  )
  .appliesTo('server', 'origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        not(method('GET')),
        or(statusCode(206), responseHeader('content-range')),
      ),
      (req: CommonHttpRequest, res: CommonHttpResponse, location) => {
        const partialEvidence: string[] = [];

        if (res.statusCode === 206) {
          partialEvidence.push('a 206 (Partial Content) status');
        }

        if (hasHeader(res.headers, 'content-range')) {
          partialEvidence.push('a Content-Range response header');
        }

        if (partialEvidence.length === 0) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `A ${req.method} request was answered with ${partialEvidence.join(
                ' and ',
              )}, indicating the server applied range handling. GET is the only method for which range handling is defined; for any other method the server MUST ignore the Range header field.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
