export const thymianConfigSchema = {
  type: 'object',
  properties: {
    autoload: {
      type: 'boolean',
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
