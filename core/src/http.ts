export type HttpRequest = {
  origin: string;
  path: string;
  method: string;
  bodyEncoding?: string;
  body?: string;
  headers?: Record<string, string | string[] | undefined>;
};

export type HttpResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body?: string;
  bodyEncoding?: string;
  trailers: Record<string, string>;
  duration: number;
};
