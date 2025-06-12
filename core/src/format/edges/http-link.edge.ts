// response -> request
import type { ThymianBaseEdge } from './edge.js';

export interface HttpLink extends ThymianBaseEdge {
  type: 'http-link';
  headers?: Record<string, unknown>;
  queryParameters?: Record<string, unknown>;
  cookies?: Record<string, unknown>;
  pathParameters?: Record<string, unknown>;
  body?: unknown;
}
