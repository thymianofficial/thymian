import { ajv } from '@thymian/core';

import type { HarLog } from './har-types.js';

/**
 * Minimal JSON Schema for HAR 1.2 structure validation.
 * Validates only the fields consumed by the plugin — additional
 * HAR properties are allowed via `additionalProperties: true`.
 */
const harLogSchema = {
  type: 'object' as const,
  required: ['log'] as const,
  additionalProperties: true,
  properties: {
    log: {
      type: 'object' as const,
      required: ['entries'] as const,
      additionalProperties: true,
      properties: {
        version: { type: 'string' as const },
        entries: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            required: ['request', 'time'] as const,
            additionalProperties: true,
            properties: {
              time: { type: 'number' as const },
              request: {
                type: 'object' as const,
                required: ['method', 'url', 'headers'] as const,
                additionalProperties: true,
                properties: {
                  method: { type: 'string' as const },
                  url: { type: 'string' as const },
                  headers: {
                    type: 'array' as const,
                    items: {
                      type: 'object' as const,
                      required: ['name', 'value'] as const,
                      additionalProperties: true,
                      properties: {
                        name: { type: 'string' as const },
                        value: { type: 'string' as const },
                      },
                    },
                  },
                  postData: {
                    type: 'object' as const,
                    nullable: true,
                    additionalProperties: true,
                    properties: {
                      text: { type: 'string' as const, nullable: true },
                      mimeType: { type: 'string' as const, nullable: true },
                    },
                  },
                },
              },
              response: {
                type: 'object' as const,
                nullable: true,
                required: ['status', 'headers', 'content'] as const,
                additionalProperties: true,
                properties: {
                  status: { type: 'number' as const },
                  headers: {
                    type: 'array' as const,
                    items: {
                      type: 'object' as const,
                      required: ['name', 'value'] as const,
                      additionalProperties: true,
                      properties: {
                        name: { type: 'string' as const },
                        value: { type: 'string' as const },
                      },
                    },
                  },
                  content: {
                    type: 'object' as const,
                    required: ['size'] as const,
                    additionalProperties: true,
                    properties: {
                      text: { type: 'string' as const, nullable: true },
                      size: { type: 'number' as const },
                      mimeType: { type: 'string' as const, nullable: true },
                      encoding: { type: 'string' as const, nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const validateFn = ajv.compile(harLogSchema);

export function validateHar(data: unknown): data is HarLog {
  return validateFn(data) as boolean;
}

export function getValidationErrors(): string {
  return ajv.errorsText(validateFn.errors);
}
