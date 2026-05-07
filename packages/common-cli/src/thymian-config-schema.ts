export const thymianConfigSchema = {
  title: 'Thymian Configuration',
  description:
    'Top-level keys currently supported by the schema. Default values listed below apply when **no config file is found**; if a config file exists but omits a key, the effective value may differ (e.g., `ruleSets` becomes an empty array).',
  type: 'object',
  required: ['plugins'],
  additionalProperties: false,
  properties: {
    autoload: {
      type: 'boolean',
      description: 'Optional. Enables automatic plugin loading from `plugins`.',
      default: true,
    },
    logLevel: {
      type: 'string',
      enum: ['trace', 'debug', 'info', 'warn', 'error', 'silent'],
      description: 'Optional. Controls CLI log verbosity.',
      default: 'warn',
    },
    specifications: {
      type: 'array',
      description:
        'Optional. API descriptions to load (usually OpenAPI files).',
      default: [],
      items: {
        type: 'object',
        required: ['type', 'location'],
        additionalProperties: false,
        properties: {
          type: { type: 'string', description: 'For example `openapi`.' },
          location: { description: 'File path or supported path source.' },
          options: {
            type: 'object',
            additionalProperties: true,
            description: 'Specification-specific options.',
          },
        },
      },
    },
    traffic: {
      type: 'array',
      description:
        'Optional. Recorded traffic inputs used by `thymian analyze`.',
      default: [],
      items: {
        type: 'object',
        required: ['type', 'location'],
        additionalProperties: false,
        properties: {
          type: { type: 'string', description: 'For example `fixture`.' },
          location: { description: 'File path or supported path source.' },
          options: {
            type: 'object',
            additionalProperties: true,
            description: 'Traffic-specific options.',
          },
        },
      },
    },
    ruleSets: {
      type: 'array',
      description: 'Optional. Rule set packages to load.',
      default: [
        '@thymian/rules-rfc-9110',
        '@thymian/rules-api-description-validation',
      ],
      items: { type: 'string' },
    },
    ruleSeverity: {
      type: 'string',
      enum: ['off', 'error', 'warn', 'hint'],
      description: 'Optional. Minimum rule severity threshold.',
      default: 'error',
    },
    rules: {
      type: 'object',
      additionalProperties: true,
      description:
        'Optional. Per-rule configuration/overrides. Each key is a rule ID. The value can be a severity string (`off | error | warn | hint`) or a rule config object with `severity`, `skipOrigins`, and `options` fields.',
      default: {},
    },
    targetUrl: {
      type: 'string',
      description: 'Optional. Base URL used for live API testing workflows.',
    },
    plugins: {
      type: 'object',
      description: 'Required. Plugin registrations and plugin options.',
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: {
            type: 'string',
            description: 'Explicit module/file path.',
          },
          verbose: {
            type: 'boolean',
            description: 'Enable verbose logging for this plugin.',
          },
          options: {
            type: 'object',
            additionalProperties: true,
            description: 'Plugin-specific options.',
          },
        },
      },
    },
  },
};
