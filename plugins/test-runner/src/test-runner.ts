import { type Logger, ThymianEmitter } from '@thymian/core';
import type { HttpTest, HttpTransaction } from './types.js';

export class TestRunner {
  constructor(
    private readonly logger: Logger,
    private readonly emitter: ThymianEmitter,
    private test: HttpTest
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async run(): Promise<void> {}
}
