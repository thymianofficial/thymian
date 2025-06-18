import type { Logger } from './logger/logger.js';
import type { ThymianEmitter } from './thymian-emitter.js';

export abstract class ThymianCommand<T> {
  constructor(
    protected readonly emitter: ThymianEmitter,
    protected readonly logger: Logger
  ) {}

  abstract run(): Promise<T>;
}
