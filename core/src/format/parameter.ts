import type { SerializationStyle } from './serialization-style/index.js';
import type { ThymianSchema } from './thymian-schema.js';

export interface Parameter {
  description?: string;
  required: boolean;
  schema: ThymianSchema;
  contentType?: string;
  style: SerializationStyle;
}
