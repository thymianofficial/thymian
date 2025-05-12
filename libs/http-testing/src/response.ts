export type HttpResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  bodyEncoding?: string;
  trailers: Record<string, string>;
  duration: number;
};
