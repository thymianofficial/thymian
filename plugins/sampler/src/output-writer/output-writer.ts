import type { ThymianHttpRequest } from '@thymian/core';

import type { SampleHttRequest } from '../sample-request.js';

export interface OutputWriter {
  write(
    request: SampleHttRequest,
    requestId: string,
    thymianRequest: ThymianHttpRequest
  ): Promise<void>;
}
