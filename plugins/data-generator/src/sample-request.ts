export type SampleHttRequest = {
  headers: Record<string, unknown>;
  pathParameters: Record<string, unknown>;
  cookies: Record<string, unknown>;
  queryParameters: Record<string, unknown>;
  body?: unknown;
};
