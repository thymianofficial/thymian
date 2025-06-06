export type RequestSample = {
  headers: Record<string, unknown>;
  pathParameters: Record<string, unknown>;
  cookies: Record<string, unknown>;
  queryParameters: Record<string, unknown>;
  body?: unknown;
};

export interface RequestSampler {
  sampleRequest(reqId: string): Promise<RequestSample>;

  sampleRequestSync(reqId: string): RequestSampler;
}
