import type { ThymianBaseNode } from './node.js';

export interface SecurityScheme extends ThymianBaseNode {
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
