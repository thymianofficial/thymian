import type { ThymianSchema } from './thymian-schema.js';
import type { SerializationStyle } from './serialization-style/index.js';

export interface Parameter {
  description?: string;
  required: boolean;
  schema: ThymianSchema;
  style: SerializationStyle;
}
