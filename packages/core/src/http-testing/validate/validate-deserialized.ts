import type { ThymianSchema } from '../../format/thymian-schema.js';
import {
  type DeserializeResult,
  malformedStyleMessage,
  unsupportedStyleMessage,
} from '../deserialize-parameter.js';
import type { HttpTestCaseResult } from '../http-test/index.js';
import { ajv } from './ajv.js';
import { describeSchemaError, schemaErrorDetail } from './schema-error.js';

/**
 * Turn a `DeserializeResult` into test-case results.
 *
 * All four validators — query, path, request headers, response headers — do
 * exactly this, and the shape had already been copied four times and started
 * to diverge. The contract lives here so it cannot rot in three places while
 * being fixed in the fourth.
 *
 * `subject` is the capitalised label for a sentence (`Header "x-count"`);
 * `lowerSubject` is the same thing mid-sentence, as `describeSchemaError`
 * wants it (`header "x-count"`).
 */
export function resultsForDeserialized(
  deserialized: DeserializeResult,
  schema: ThymianSchema,
  subject: string,
  lowerSubject: string,
  validLabel: string,
): HttpTestCaseResult[] {
  if (!deserialized.supported) {
    // A style thymian cannot reverse is thymian's limitation (`info`); a value
    // not in its declared style is the request's defect (a failure).
    return [
      deserialized.malformed
        ? {
            type: 'assertion-failure',
            message: malformedStyleMessage(subject, deserialized),
            timestamp: Date.now(),
          }
        : {
            type: 'info',
            message: unsupportedStyleMessage(subject, deserialized),
            timestamp: Date.now(),
          },
    ];
  }

  const validate = ajv.compile(schema);

  validate(deserialized.value);

  if (validate.errors && validate.errors.length > 0) {
    // One assertion-failure per schema error rather than a joined message.
    return validate.errors.map((err) => ({
      type: 'assertion-failure',
      message: describeSchemaError(err, lowerSubject),
      ...schemaErrorDetail(err),
      timestamp: Date.now(),
    }));
  }

  return [
    {
      type: 'assertion-success',
      message: validLabel,
      timestamp: Date.now(),
    },
  ];
}
