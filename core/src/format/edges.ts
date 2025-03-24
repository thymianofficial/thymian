export interface ThymianEdge {
  type: string;
  extensions?: Record<PropertyKey, unknown>;
}
// response -> request
export interface HttpLink extends ThymianEdge {
  type: 'http-link';
  headers?: Record<string, unknown>;
  queryParameters?: Record<string, unknown>;
  cookies?: Record<string, unknown>;
  pathParameters?: Record<string, unknown>;
  body?: unknown;
}

// request -> response
export interface HttpTransaction extends ThymianEdge {
  type: 'http-transaction';
}

export interface IsSecuredWith extends ThymianEdge {
  type: 'is-secured';
}

export type ThymianEdges =
  | HttpLink
  | HttpTransaction
  | ThymianEdge
  | IsSecuredWith;
