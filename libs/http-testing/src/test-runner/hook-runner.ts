import type { HttpRequest } from '../request.js';
import type { HttpResponse } from '../response.js';
import type { HttpTestCase } from '../http-test/http-test.js';

export interface HookRunner {
  beforeEachRequest(
    request: HttpRequest,
    testCase: Omit<HttpTestCase, 'response'>
  ): Promise<HttpRequest>;

  afterEachRequest(request: HttpRequest): Promise<HttpResponse>;
}
