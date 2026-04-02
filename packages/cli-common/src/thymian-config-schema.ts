export const thymianConfigSchema = {
  type: 'object',
  properties: {
    autoload: {
      type: 'boolean',
    },
    logLevel: {
      type: 'string',
      enum: ['trace', 'debug', 'info', 'warn', 'error', 'silent'],
    },
    specifications: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'location'],
        additionalProperties: false,
        properties: {
          type: { type: 'string' },
          location: {},
          options: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    traffic: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'location'],
        additionalProperties: false,
        properties: {
          type: { type: 'string' },
          location: {},
          options: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    ruleSets: {
      type: 'array',
      items: { type: 'string' },
    },
    ruleSeverity: {
      type: 'string',
      enum: ['off', 'error', 'warn', 'hint'],
    },
    rules: {
      type: 'object',
      additionalProperties: true,
    },
    plugins: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: {
            type: 'string',
          },
          verbose: {
            type: 'boolean',
          },
          options: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
  },
};
