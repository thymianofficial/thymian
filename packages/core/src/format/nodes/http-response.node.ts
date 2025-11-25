import type { Parameter } from '../parameter.js';
import type { ThymianSchema } from '../thymian-schema.js';
import type { ThymianBaseNode } from './node.js';

export interface ThymianHttpResponse extends ThymianBaseNode {
  type: 'http-response';
  description?: string;
  headers: Record<string, Parameter>;
  mediaType: string;
  statusCode: number;
  schema?: ThymianSchema;
}
