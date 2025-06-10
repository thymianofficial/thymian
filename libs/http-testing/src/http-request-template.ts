export type HttpRequestTemplate = {
  origin: string;
  path: string;
  pathParameters: Record<string, unknown>;
  method: string;
  query: Record<string, unknown>;
  bodyEncoding?: string;
  body?: unknown;
  headers: Record<string, unknown>;
  cookies: Record<string, unknown>;
};
