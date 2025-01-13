import { EventEmitter2 } from 'eventemitter2';
import type { Logger } from './logger/logger.js';
import type { ThymianError } from './thymian.error.js';

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export type ThymianListerFn = (...args: any[]) => void | Promise<void>;

export type ThymianListerAsyncFn<T = unknown> = (
  ...args: unknown[]
) => Promise<T> | T;

export type ThymianEmitterOptions = {
  timeout?: number;
};

export type ThymianEvent = 'thymian.ready' | 'thymian.close';

export class ThymianEmitter {
  private timeoutHandler: NodeJS.Timeout | undefined;
  private timeoutResolve!: () => void;
  private readonly timeoutPromise: Promise<void>;

  constructor(
    private readonly logger: Logger,
    private readonly options: ThymianEmitterOptions = { timeout: 1000 },
    private readonly emitter = new EventEmitter2({
      wildcard: true,
      delimiter: '.',
      maxListeners: 100,
    })
  ) {
    this.timeoutPromise = new Promise((resolve) => {
      this.timeoutResolve = resolve;
    });
    this.resetTimeout();
  }

  on(event: string, listener: ThymianListerFn): void {
    this.emitter.on(event, listener);
  }

  onAsync<T>(
    event: string | ThymianEvent,
    listener: ThymianListerAsyncFn<T>
  ): void {
    this.emitter.on(event, listener, {
      async: true,
      promisify: true,
      nextTick: false,
    });
  }

  emitError(err: ThymianError): void {
    this.emit('thymian.error', err);
  }

  emitExit(code: number, reason: string): void {
    this.emit('thymian.exit', code, reason);
  }

  emit(event: string, ...args: unknown[]): void {
    this.resetTimeout();
    this.logger.debug(`Emitting event "${event}".`);
    this.emitter.emit(event, ...args);
  }

  emitAsync<T = unknown>(event: string, ...args: unknown[]): Promise<T[]> {
    this.resetTimeout();
    this.logger.debug(`Emitting event "${event}".`);
    return this.emitter.emitAsync(event, ...args) as Promise<T[]>;
  }

  once(event: string, listener: ThymianListerFn): void {
    this.emitter.once(event, listener, {
      async: true,
      promisify: true,
      nextTick: false,
    });
  }

  public onIdle(): Promise<void> {
    return this.timeoutPromise;
  }

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  onAny(listener: (event: string | string[], ...args: any[]) => any): void {
    this.emitter.onAny(listener);
  }

  private resetTimeout(): void {
    this.logger.debug('Reset timeout.');
    if (this.timeoutHandler) {
      clearTimeout(this.timeoutHandler);
    }

    this.timeoutHandler = setTimeout(
      this.timeoutResolve,
      this.options.timeout ?? 1000
    );
  }
}
