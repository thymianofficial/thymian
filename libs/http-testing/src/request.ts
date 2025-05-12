export type HttpRequest = {
  protocol: 'http' | 'https';
  // like /users/{id} and without query parameters
  path: string;
  host: string;
  port: number;
  method: string;
  query: Record<string, string>;
  pathParameters: Record<string, string>;
  body?: string;
  contentType: string;
  headers: Record<string, string | string[]>;
  timeout?: number;
};
