import { EOL } from 'node:os';

import { ajv } from '@thymian/core';

import thymianSchema from './thymian-config-schema.json' with { type: 'json' };

const validationFn = ajv.compile(thymianSchema);

export type ConfigValidationResult =
  | {
      valid: true;
    }
  | {
      valid: boolean;
      message: string;
    };

export function validateConfig(config: unknown): ConfigValidationResult {
  const valid = validationFn(config);

  if (valid) {
    return { valid };
  } else {
    return {
      valid,
      message:
        validationFn.errors?.map((e) => EOL + '   * ' + e.message).join('') ??
        'Unknown error',
    };
  }
}
