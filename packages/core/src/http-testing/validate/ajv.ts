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
