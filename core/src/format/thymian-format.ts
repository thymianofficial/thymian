import { ThymianSchema } from './schema/index.js';
import { SerializationStyle } from './serialization-style/index.js';

export interface ThymianNode {
  id: string;
  type: string;
}

export interface ThymianEdge {
  id: string;
  type: string;
  source: string;
  target: string;
}

export interface Parameter {
  description?: string;
  required: boolean;
  schema: ThymianSchema;
  style: SerializationStyle;
}

export interface ThymianHttpRequest extends ThymianNode {
  type: 'http-request';
  host: string;
  port: number;
  protocol: string;
  path: string;
  httpVersion: string;
  headers: Record<string, Parameter>;
  queryParameters: Record<string, Parameter>;
  cookies: Record<string, Parameter>;
  pathParameters: Record<string, Parameter>;
  description?: string;
  bodyRequired: boolean;
  body: ThymianSchema;
  mediaType: string;
}

export interface ThymianHttpResponse extends ThymianNode {
  type: 'http-response';
  description?: string;
  headers: Record<string, Parameter>;
  mediaType: string;
  statusCode: number;
  schema: ThymianSchema;
}

// response -> request
export interface HttpLink extends ThymianEdge {
  type: 'http-link';
}

// request -> response
export interface HttpTransaction extends ThymianEdge {
  type: 'http-transaction';
}

export class ThymianFormat {
  readonly nodes: ThymianNode[] = [];
  readonly edges: ThymianEdge[] = [];
}
