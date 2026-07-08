export type HttpRequest = {
  origin: string;
  path: string;
  /**
   * Full request target URI as captured (absolute-form), retaining
   * subcomponents such as userinfo that `origin` normalizes away. Populated by
   * sources that record the complete URI (e.g. HAR); undefined otherwise.
   */
  target?: string;
  method: string;
  bodyEncoding?: string;
  body?: string;
  headers?: Record<string, string | string[] | undefined>;
};

export type HttpRequestTemplate = {
  origin: string;
  path: string;
  pathParameters: Record<string, unknown>;
  method: string;
  query: Record<string, unknown>;
  authorize: boolean;
  bodyEncoding?: string;
  body?: unknown;
  headers: Record<string, unknown>;
  cookies: Record<string, unknown>;
};

export type HttpResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body?: string;
  bodyEncoding?: string;
  trailers: Record<string, string>;
  duration: number;
};
