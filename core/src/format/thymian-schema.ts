export type ThymianSchemaType =
  | 'null'
  | 'boolean'
  | 'object'
  | 'array'
  | 'number'
  | 'string'
  | 'integer';

export type ThymianSchema =
  | boolean
  | {
      // Type
      type?: ThymianSchemaType | ThymianSchemaType[];
      const?: unknown;
      enum?: unknown[];

      examples?: unknown[];
      default?: unknown;

      // Numbers
      multipleOf?: number;
      maximum?: number;
      exclusiveMaximum?: number;
      minimum?: number;
      exclusiveMinimum?: number;

      // Strings
      maxLength?: number;
      minLength?: number;
      pattern?: string;
      format?: string;
      contentEncoding?: string;
      contentMediaType?: string;

      // Arrays
      prefixItems?: ThymianSchema[];
      items?: ThymianSchema;
      contains?: ThymianSchema;
      minItems?: number;
      maxItems?: number;
      uniqueItems?: boolean;
      minContains?: number;
      maxContains?: number;

      // Objects
      properties?: Record<string, ThymianSchema>;
      patternProperties?: Record<string, ThymianSchema>;
      additionalProperties?: ThymianSchema | boolean;
      propertyNames?: ThymianSchema;
      required?: string[];
      minProperties?: number;
      maxProperties?: number;
      dependentSchemas?: Record<string, ThymianSchema>;
      dependentRequired?: Record<string, string[]>;

      allOf?: ThymianSchema[];
      anyOf?: ThymianSchema[];
      oneOf?: ThymianSchema[];
      not?: ThymianSchema;
      if?: ThymianSchema;
      then?: ThymianSchema;
      else?: ThymianSchema;

      unevaluatedProperties?: ThymianSchema | boolean;
      unevaluatedItems?: ThymianSchema | boolean;

      $ref?: string;
      $anchor?: string;
    };
