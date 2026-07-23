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
// Any numeral with more digits than MAX_REASONABLE_SIZE is necessarily larger
// than it, so digit count alone rules out most hostile values cheaply.
const MAX_REASONABLE_DIGITS = MAX_REASONABLE_SIZE.toString().length;

export default httpRule('rfc9110/recipient-must-handle-large-content-length')
  .severity('warn')
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

        // A present Content-Length header whose value is empty or whitespace-
        // only carries no decimal numeral at all (Content-Length = 1*DIGIT)
        // and must not be ignored: downstream parsers disagree on how to
        // frame such a message.
        if (tokens.length === 0) {
          return [
            {
              location,
              violation: {
                message:
                  'The response carries a Content-Length header field with an empty value, which is not a valid decimal numeral (Content-Length = 1*DIGIT) and cannot be parsed safely.',
              },
              findings: [],
            },
          ];
        }

        // More than one Content-Length value (whether across repeated header
        // lines or within a comma-separated list) is a message-framing hazard,
        // but RFC 9110 Section 8.6 distinguishes two cases: the same decimal
        // value repeated (e.g. "42, 42") may be either rejected or replaced
        // with a single instance by the recipient, while differing values
        // leave downstream parsers to disagree on which value delimits the
        // body and MUST be rejected (request smuggling / response splitting).
        if (tokens.length > 1) {
          const listed = tokens.map((token) => `"${token}"`).join(', ');
          const conflicting = new Set(tokens).size > 1;
          results.push({
            location,
            violation: {
              message: conflicting
                ? `The response carries conflicting Content-Length values (${listed}). Differing Content-Length header lines or comma-separated values are a message-framing hazard that a recipient MUST reject (request smuggling / response splitting).`
                : `The response carries the same Content-Length value repeated (${listed}). A recipient MUST either reject the message or replace the repeated values with a single instance; a sender ought to generate a single Content-Length value.`,
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

          // Strip leading zeros so the digit-count bound below is exact, then
          // flag oversized numerals by digit count alone where possible —
          // this avoids materializing a BigInt from an arbitrarily long
          // hostile numeral and parses at most once otherwise.
          const digits = token.replace(/^0+(?=\d)/, '');
          if (
            digits.length > MAX_REASONABLE_DIGITS ||
            (digits.length === MAX_REASONABLE_DIGITS &&
              BigInt(digits) > MAX_REASONABLE_SIZE)
          ) {
            results.push({
              location,
              violation: {
                message: `Content-Length value ${digits} exceeds a reasonable size limit (>1 TB); such large numerals are a potential integer-overflow / precision-loss hazard for recipients.`,
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
