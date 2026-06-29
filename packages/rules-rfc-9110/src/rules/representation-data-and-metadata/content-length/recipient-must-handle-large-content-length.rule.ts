import {
  getHeader,
  responseHeader,
  type RuleFnResult,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

// Roughly 1 TB. A real Content-Length above this is extraordinarily unusual and
// is a strong indicator of a malformed or hostile value crafted to provoke
// integer-overflow / precision-loss parsing bugs in recipients.
const MAX_REASONABLE_SIZE = BigInt(2) ** BigInt(40);

export default httpRule('rfc9110/recipient-must-handle-large-content-length')
  .severity('warn')
  // Implementable now (outcome 1): the underlying MUST targets the RECIPIENT's
  // parser robustness, which is internal and not directly observable. What IS
  // observable is the Content-Length VALUE(s) a sender put on the wire, so this
  // rule surfaces (a) multiple/conflicting Content-Length values — whether as
  // repeated header lines (a string[] from the HAR transformer) or a
  // comma-separated list such as "42, 42" — which are a message-framing /
  // request-smuggling hazard the recipient MUST reject, and (b) individual
  // values that are non-numeric/unparseable or implausibly large (>1 TB), the
  // inputs that drive the overflow/precision hazards the RFC warns about.
  // Reading the field value requires the live/captured projection, so it is
  // typed `test` + `analytics`. `appliesTo('origin server')` so the analyze
  // rule fires on HAR responses (default response role).
  .type('test', 'analytics')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A recipient MUST anticipate potentially large decimal numerals and prevent parsing errors due to integer
    conversion overflows or precision loss due to integer conversion. Content-Length values should be validated
    to ensure they don't exceed reasonable limits that could cause security issues.`,
  )
  .summary(
    'Content-Length values should be checked for integer overflow risks.',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      responseHeader('content-length'),
      (_req, res, location: RuleViolationLocation) => {
        const contentLengthHeader = getHeader(res.headers, 'content-length');

        if (contentLengthHeader === undefined) {
          return [];
        }

        // The HAR transformer (and HTTP/1.1 itself) can surface a REPEATED
        // Content-Length header as a string[] of multiple field lines, and a
        // single field line may itself be a comma-separated list (e.g.
        // "42, 42"). Both forms are the classic message-framing / request-
        // smuggling shape RFC 9110 Section 8.6 requires a recipient to guard
        // against. Flatten every field line into its comma-separated tokens so
        // each can be checked, while remembering whether more than one value
        // was present.
        const lines = Array.isArray(contentLengthHeader)
          ? contentLengthHeader
          : [contentLengthHeader];

        const tokens = lines
          .flatMap((line) => line.split(','))
          .map((token) => token.trim())
          .filter((token) => token.length > 0);

        const results: RuleFnResult[] = [];

        // More than one Content-Length value (whether across repeated header
        // lines or within a comma-separated list) is itself a framing
        // violation: a recipient MUST reject such a message because downstream
        // parsers may disagree on which value delimits the body (request
        // smuggling / response splitting).
        if (tokens.length > 1) {
          results.push({
            location,
            violation: {
              message: `The response carries multiple/conflicting Content-Length values (${tokens
                .map((token) => `"${token}"`)
                .join(
                  ', ',
                )}). Multiple Content-Length header lines or comma-separated values are a message-framing hazard that a recipient MUST reject (request smuggling / response splitting).`,
            },
            findings: [],
          });
        }

        // A well-formed Content-Length is a single non-negative decimal numeral
        // (RFC 9110 Section 8.6). Validate each present token for the ABNF and
        // for an implausibly large value (>1 TB) that risks integer-overflow /
        // precision-loss parsing bugs in recipients.
        for (const token of tokens) {
          if (!/^\d+$/.test(token)) {
            results.push({
              location,
              violation: {
                message: `Content-Length value "${token}" is not a single decimal numeral and cannot be parsed safely; recipients MUST guard against such values (request smuggling / parsing-error risk).`,
              },
              findings: [],
            });
            continue;
          }

          if (BigInt(token) > MAX_REASONABLE_SIZE) {
            results.push({
              location,
              violation: {
                message: `Content-Length value ${BigInt(
                  token,
                ).toString()} exceeds a reasonable size limit (>1 TB); such large numerals are a potential integer-overflow / precision-loss hazard for recipients.`,
              },
              findings: [],
            });
          }
        }

        return results;
      },
    ),
  )
  .done();
