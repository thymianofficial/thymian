export type ExitEvent = {
  code?: number;
};

export const ExitEventSchema = {
  type: 'object',
  required: ['code'],
  properties: {
    code: { type: 'integer' },
  },
  additionalProperties: false,
} as const;
