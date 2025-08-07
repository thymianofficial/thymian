import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export const ajv = new Ajv2020();

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
addFormats(ajv);
