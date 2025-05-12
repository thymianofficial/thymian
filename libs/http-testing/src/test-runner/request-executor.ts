import type { HttpRequest } from '../request.js';
import type { HttpResponse } from '../response.js';

export interface HttpRequestExecutor {
  request(request: HttpRequest): Promise<HttpResponse>;

  requestWithLock(request: HttpRequest): Promise<HttpResponse>;

  parallel(request: HttpRequest[]): Promise<HttpResponse[]>;
}
