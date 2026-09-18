import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// `allErrors` so schema validation collects every error, letting validators
// surface one assertion-failure per error instead of only the first one.
// `verbose` so each error carries the offending `data` (and `schema`), letting
// validators report the actual value alongside the expected constraint.
export const ajv = new Ajv2020({ allErrors: true, verbose: true });

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
addFormats(ajv);

// OpenAPI's `xml` object is a first-class ThymianSchema field (plugin-sampler
// consumes it to render XML samples) but carries no JSON Schema validation
// semantics. Register it as a no-op annotation so Ajv strict mode tolerates it
// instead of throwing, while still rejecting genuinely unknown keywords (typos).
ajv.addKeyword({ keyword: 'xml', valid: true });
