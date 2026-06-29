import {
  getHeader,
  responseHeader,
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
  // observable is the Content-Length VALUE a sender put on the wire, so this
  // rule surfaces values that are non-numeric/unparseable or implausibly large
  // (>1 TB) — the inputs that drive the overflow/precision hazards the RFC warns
  // about. Reading the field value requires the live/captured projection, so it
  // is typed `test` + `analytics`. `appliesTo('origin server')` so the analyze
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

        if (typeof contentLengthHeader !== 'string') {
          return [];
        }

        const trimmed = contentLengthHeader.trim();

        // A well-formed Content-Length is a single non-negative decimal numeral
        // (RFC 9110 Section 8.6). Anything else (non-numeric, signed, or a
        // comma-separated list such as "42, 42") cannot be parsed safely as a
        // length and is the exact class of value the recipient MUST guard
        // against.
        if (!/^\d+$/.test(trimmed)) {
          return [
            {
              location,
              violation: {
                message: `Content-Length value "${contentLengthHeader}" is not a single decimal numeral and cannot be parsed safely; recipients MUST guard against such values (request smuggling / parsing-error risk).`,
              },
              findings: [],
            },
          ];
        }

        const numericValue = BigInt(trimmed);

        if (numericValue > MAX_REASONABLE_SIZE) {
          return [
            {
              location,
              violation: {
                message: `Content-Length value ${numericValue.toString()} exceeds a reasonable size limit (>1 TB); such large numerals are a potential integer-overflow / precision-loss hazard for recipients.`,
              },
              findings: [],
            },
          ];
        }

        return [];
      },
    ),
  )
  .done();
