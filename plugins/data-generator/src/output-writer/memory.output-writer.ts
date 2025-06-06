import type { SampleHttRequest } from 'src/sample-request.js';

import type { OutputWriter } from './output-writer.js';

export class MemoryOutputWriter implements OutputWriter {
  readonly samples: Map<string, SampleHttRequest[]> = new Map();

  async write(request: SampleHttRequest, requestId: string): Promise<void> {
    const existingSamples = this.samples.get(requestId) || [];
    existingSamples.push(request);
    this.samples.set(requestId, existingSamples);
  }
}
