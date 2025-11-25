import type { Parameter } from '../parameter.js';
import type { SerializationStyle } from '../serialization-style/index.js';
import type { ThymianSchema } from '../thymian-schema.js';
import type { ThymianBaseNode } from './node.js';

export type Encoding = {
  [propertyName: string]: {
    contentType?: string;
    headers: Record<string, Parameter>;
    serializationStyle: SerializationStyle;
  };
};

export interface ThymianHttpRequest extends ThymianBaseNode {
  type: 'http-request';
  host: string;
  port: number;
  protocol: 'http' | 'https';
  path: string;
  method: string;
  headers: Record<string, Parameter>;
  queryParameters: Record<string, Parameter>;
  cookies: Record<string, Parameter>;
  pathParameters: Record<string, Parameter>;
  description?: string;
  bodyRequired?: boolean;
  body?: ThymianSchema;
  mediaType: string;
  encoding?: Encoding;
}
