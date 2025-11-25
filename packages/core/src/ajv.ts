import { Ajv2020, type JSONSchemaType } from 'ajv/dist/2020.js';

const ajv = new Ajv2020();

function validate<T>(schema: JSONSchemaType<T>, data: unknown): data is T {
  return ajv.validate(schema, data);
}

export { ajv, type JSONSchemaType, validate };
