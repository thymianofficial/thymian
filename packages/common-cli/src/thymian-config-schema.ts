// One schema, two surfaces: `thymian-config-schema.json` is what ajv validates
// against at runtime (see `validate-config.ts`) and what generates the
// published reference page. This module is the import-friendly surface for
// consumers of the package, re-exported from the package entry point, and by
// re-exporting rather than restating the schema it cannot drift from it.
import schema from './thymian-config-schema.json' with { type: 'json' };

export const thymianConfigSchema = schema;
