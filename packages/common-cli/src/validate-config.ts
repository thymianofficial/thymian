import { EOL } from 'node:os';

import { ajv, formatAjvErrors } from '@thymian/core';

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
    const { message, details } = formatAjvErrors(validationFn.errors);

    return {
      valid,
      message:
        details.length > 0
          ? details.map((detail) => EOL + '   * ' + detail).join('')
          : message,
    };
  }
}
