import {
  getHeader,
  not,
  responseHeader,
  statusCode,
  type HttpResponse,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

// Parse an Allow header value into its list of method tokens.
// Splits on ',', trims, and drops empty entries so that an empty
// "Allow:" (present header name, no methods) yields zero tokens.
function allowMethodTokens(value: string | string[] | undefined): string[] {
  const list = Array.isArray(value) ? value : value != null ? [value] : [];
  return list
    .flatMap((v) => v.split(','))
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export default httpRule(
  'rfc9110/origin-sever-must-generate-allow-header-for-405-response',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-405-method-not-allowed',
  )
  .description(
    "The origin server MUST generate an Allow header field in a 405 response containing a list of the target resource's currently supported methods.",
  )
  .appliesTo('origin server')
  // Static floor: the spec only exposes header NAMES, so we can only assert
  // the Allow header is declared. The real-data contexts below additionally
  // read the VALUE to catch an empty "Allow:" that satisfies presence but
  // lists zero methods (still a MUST violation).
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(405),
      not(responseHeader('allow')),
    ),
  )
  .overrideTest((ctx) =>
    ctx.validateHttpTransactions(
      statusCode(405),
      (_req, res: HttpResponse, location: RuleViolationLocation) => {
        const tokens = allowMethodTokens(getHeader(res.headers, 'allow'));
        return tokens.length === 0
          ? [
              {
                location,
                violation: {
                  message:
                    'A 405 (Method Not Allowed) response is missing a non-empty Allow header field. The origin server MUST generate an Allow header field listing the target resource’s currently supported methods.',
                },
                findings: [],
              },
            ]
          : [];
      },
    ),
  )
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      statusCode(405),
      (_req, res: HttpResponse, location: RuleViolationLocation) => {
        const tokens = allowMethodTokens(getHeader(res.headers, 'allow'));
        return tokens.length === 0
          ? [
              {
                location,
                violation: {
                  message:
                    'A 405 (Method Not Allowed) response is missing a non-empty Allow header field. The origin server MUST generate an Allow header field listing the target resource’s currently supported methods.',
                },
                findings: [],
              },
            ]
          : [];
      },
    ),
  )
  .done();
