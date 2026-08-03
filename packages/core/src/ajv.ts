import { AggregateAjvError } from '@segment/ajv-human-errors';
import type { ErrorObject } from 'ajv';
import { Ajv2020, type JSONSchemaType } from 'ajv/dist/2020.js';

const ajv = new Ajv2020({
  allowUnionTypes: true,
  allErrors: true,
  verbose: true,
});

function validate<T>(schema: JSONSchemaType<T>, data: unknown): data is T {
  return ajv.validate(schema, data);
}

// Cap how many individual errors we surface. `allErrors: true` collects every
// failing constraint, so a deeply-invalid config/options object can produce a
// huge list; bounding it keeps error output (and the interpolated message)
// readable and avoids flooding logs on adversarial input.
const MAX_DETAILS = 20;

/**
 * Wrap raw Ajv errors into a human-readable summary using
 * `@segment/ajv-human-errors`. The shared `ajv` instance is configured with
 * `allErrors` + `verbose` (both required by the library) so the errors carry
 * enough context to produce readable messages.
 *
 * Never throws and never returns an empty message for a non-empty error list:
 * `@segment/ajv-human-errors` can throw (e.g. `additionalProperties: false`
 * without `properties`, or `patternProperties`) or yield no renderable
 * messages, so we fall back to Ajv's own `errorsText` in those cases.
 */
function formatAjvErrors(errors: ErrorObject[] | null | undefined): {
  message: string;
  details: string[];
} {
  if (!errors?.length) {
    return { message: 'Unknown validation error', details: [] };
  }

  let details: string[] = [];
  try {
    const aggregate = new AggregateAjvError(errors);
    details = [...aggregate]
      .map((error) => error.message)
      .filter((message): message is string => Boolean(message));
  } catch {
    // Library could not render these errors — fall through to Ajv's text.
    details = [];
  }

  if (details.length === 0) {
    const text = ajv.errorsText(errors);
    return { message: text, details: [text] };
  }

  if (details.length > MAX_DETAILS) {
    details = [
      ...details.slice(0, MAX_DETAILS),
      `…and ${details.length - MAX_DETAILS} more validation error(s).`,
    ];
  }

  return { message: details.join(' '), details };
}

export { ajv, formatAjvErrors, type JSONSchemaType, validate };
