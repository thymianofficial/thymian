import type { Parameter } from './parameter.js';
import { ThymianSchema } from './schema/index.js';
import type { SerializationStyle } from './serialization-style/index.js';

export interface ThymianNode {
  type: string;
  extensions?: Record<PropertyKey, unknown>;
}

export type Encoding = {
  [propertyName: string]: {
    contentType?: string;
    headers: Record<string, Parameter>;
    serializationStyle: SerializationStyle;
  };
};

export interface ThymianHttpRequest extends ThymianNode {
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

export interface SecurityScheme extends ThymianNode {
  type: 'security-scheme';
  scheme: 'basic' | 'bearer' | 'api-key';
}

export interface BasicSecurityScheme extends SecurityScheme {
  scheme: 'basic';
}

export interface BearerSecurityScheme extends SecurityScheme {
  scheme: 'bearer';
  bearerFormat?: string;
}

export interface ApiKeySecurityScheme extends SecurityScheme {
  scheme: 'api-key';
  in: string;
}

export interface ThymianHttpResponse extends ThymianNode {
  type: 'http-response';
  description?: string;
  headers: Record<string, Parameter>;
  mediaType: string;
  statusCode: number;
  schema: ThymianSchema;
}

export type ThymianNodes =
  | ThymianHttpRequest
  | ThymianHttpResponse
  | SecurityScheme
  | BasicSecurityScheme
  | BearerSecurityScheme
  | ApiKeySecurityScheme
  | ThymianNode;

export function isNodeType<T extends ThymianNodes>(
  node: ThymianNodes,
  type: ThymianNodes['type']
): node is T {
  return node.type === type;
}
