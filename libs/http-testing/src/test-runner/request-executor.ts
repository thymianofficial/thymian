import type { HttpRequestTemplate } from '../rxjs/http-request-template.js';
import type { HttpResponse } from '../rxjs/http-response.js';

export interface HttpRequestExecutor {
  request(request: HttpRequestTemplate): Promise<HttpResponse>;

  requestWithLock(request: HttpRequestTemplate): Promise<HttpResponse>;

  parallel(request: HttpRequestTemplate[]): Promise<HttpResponse[]>;
}
