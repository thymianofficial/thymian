import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { SampleHttRequest } from '../sample-request.js';
import type { OutputWriter } from './output-writer.js';

export class FileOutputWriter implements OutputWriter {
  private readonly timestamp: number;
  private readonly counter: Map<string, number> = new Map();

  constructor(private readonly basePath: string) {
    this.timestamp = Date.now();
  }

  async write(sample: SampleHttRequest, requestId: string): Promise<void> {
    const path = join(
      this.basePath,
      'requests',
      this.timestamp.toString(),
      requestId
    );

    await mkdir(path, { recursive: true });

    const fileName = String(this.getCounterForRequest(requestId)).padStart(
      5,
      '0'
    );

    await writeFile(join(path, fileName) + '.json', JSON.stringify(sample), {
      encoding: 'utf8',
    });
  }

  private getCounterForRequest(requestId: string): number {
    const curr = this.counter.get(requestId);

    const updatedCounter = (curr ?? 0) + 1;

    this.counter.set(requestId, updatedCounter);

    return updatedCounter;
  }
}
