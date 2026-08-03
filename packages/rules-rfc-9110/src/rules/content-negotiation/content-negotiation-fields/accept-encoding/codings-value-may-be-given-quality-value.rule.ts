import {
  getHeader,
  requestHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

/**
 * The informational hint surfaced to the user: each Accept-Encoding codings
 * value MAY carry a quality value (weight) expressing preference.
 */
const hintMessage =
  'Each codings value in Accept-Encoding MAY be given an associated quality value (weight) representing the preference for that encoding, as defined in Section 12.4.2.';

function headerToString(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value.join(',') : value;
}

/** Whether any codings entry in an Accept-Encoding value carries a "q" weight. */
function hasQualityValue(value: string): boolean {
  return value.split(',').some((entry) =>
    entry
      .split(';')
      .slice(1)
      .some((param) => param.trim().toLowerCase().startsWith('q=')),
  );
}

export default httpRule('rfc9110/codings-value-may-be-given-quality-value')
  .severity('hint')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-encoding')
  .description(
    'Each codings value MAY be given an associated quality value (weight) representing the preference for that encoding, as defined in Section 12.4.2.',
  )
  .explanation(
    'In Accept-Encoding, a client may optionally attach a quality value (a q= weight from 0 to 1) to each content coding it lists, to say how much it prefers one encoding over another. This is entirely optional; without weights every listed coding is treated as equally acceptable. Using weights lets a client steer the server toward a preferred compression, or rule out a coding with q=0, making content negotiation more expressive when the client actually cares about the choice.',
  )
  // Static context can only observe that the request carries Accept-Encoding,
  // so it always surfaces the hint about the available quality-value mechanism.
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      requestHeader('accept-encoding'),
      (_req, _res, location: RuleViolationLocation) => [
        { location, violation: { message: hintMessage }, findings: [] },
      ],
    ),
  )
  // Analytics has the actual header value: only surface the hint when none of
  // the codings already carry a quality value.
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      requestHeader('accept-encoding'),
      (req, _res, location: RuleViolationLocation) => {
        const acceptEncoding = headerToString(
          getHeader(req.headers, 'accept-encoding'),
        );

        if (!acceptEncoding || hasQualityValue(acceptEncoding)) {
          return [];
        }

        return [
          { location, violation: { message: hintMessage }, findings: [] },
        ];
      },
    ),
  )
  .done();
