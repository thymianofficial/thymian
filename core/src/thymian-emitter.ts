import { EventEmitter2 } from 'eventemitter2';
import type { Logger } from './logger/logger.js';
import type { ThymianError } from './thymian.error.js';

// eslint-disable-next-line
export interface ThymianHooks {}

export interface ThymianEvents {
  'thymian.error': [ThymianError];
}

export type ThymianListerFn<Args extends unknown[]> = (
  ...args: Args
) => void | Promise<void>;

export type ThymianListerAsyncFn<Args extends unknown[], ReturnType> = (
  ...args: Args
) => Promise<ReturnType> | ReturnType;

export type ThymianEmitterOptions = {
  timeout?: number;
};

export type ThymianEvent = 'thymian.ready' | 'thymian.close';

// type MatchHook<K extends string> = K extends keyof ThymianHooks
//   ? K
//   : K extends `${infer P1}.${infer _}`
//   ? `${P1}.*` extends keyof ThymianHooks
//     ? `${P1}.*`
//     : never
//   : never;

export class ThymianEmitter {
  #timeoutHandler: NodeJS.Timeout | undefined;
  #timeoutResolve!: () => void;
  readonly #timeoutPromise: Promise<void>;
  readonly #logger: Logger;
  readonly #emitter: EventEmitter2;
  readonly #options: ThymianEmitterOptions;

  constructor(
    logger: Logger,
    options: ThymianEmitterOptions = { timeout: 3000 },
    emitter = new EventEmitter2({
      wildcard: true,
      delimiter: '.',
      maxListeners: 100,
    })
  ) {
    this.#logger = logger;
    this.#options = options;
    this.#emitter = emitter;
    this.#timeoutPromise = new Promise((resolve) => {
      this.#timeoutResolve = resolve;
    });
    this.#resetTimeout();
  }

  onEvent<Event extends keyof ThymianEvents>(
    event: Event,
    listener: ThymianListerFn<ThymianEvents[Event]>
  ): void {
    this.#emitter.on(String(event), listener);
  }

  onHook<Event extends keyof ThymianHooks>(
    event: Event,
    listener: ThymianListerAsyncFn<
      ThymianHooks[Event]['args'],
      ThymianHooks[Event]['returnType']
    >
  ): void {
    this.#emitter.on(String(event), listener, {
      async: true,
      promisify: true,
      nextTick: false,
    });
  }

  emitError(err: ThymianError): void {
    this.emitEvent('thymian.error', err);
  }

  emitEvent<Event extends keyof ThymianEvents>(
    event: Event,
    ...args: ThymianEvents[Event]
  ): void {
    this.#resetTimeout();
    this.#logger.debug(`Emitting event "${event}".`);
    this.#emitter.emit(String(event), ...args);
  }

  runHook<Event extends keyof ThymianHooks>(
    event: Event,
    ...args: ThymianHooks[Event]['args']
  ): Promise<ThymianHooks[Event]['returnType'][]> {
    this.#resetTimeout();
    this.#logger.debug(`Emitting event "${event}".`);
    return this.#emitter.emitAsync(String(event), ...args) as Promise<
      ThymianHooks[Event]['returnType'][]
    >;
  }

  // runHook<Event extends keyof ThymianHooks>(
  //   event: Event,
  //   ...args: ThymianHooks[MatchHook<Event>]['args']
  // ): Promise<ThymianHooks[MatchHook<Event>]['returnType'][]> {
  //   this.#resetTimeout();
  //
  //   return this.#emitter.emitAsync(event, args) as Promise<
  //     ThymianHooks[MatchHook<Event>]['returnType']
  //   >;
  // }

  once<Event extends keyof ThymianEvents>(
    event: Event,
    listener: ThymianListerFn<ThymianEvents[Event]>
  ): void {
    this.#emitter.once(String(event), listener, {
      async: true,
      promisify: true,
      nextTick: false,
    });
  }

  public onIdle(): Promise<void> {
    return this.#timeoutPromise;
  }

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  onAny(listener: (event: string | string[], ...args: any[]) => any): void {
    this.#emitter.onAny(listener);
  }

  #resetTimeout(): void {
    this.#logger.debug('Reset timeout.');
    if (this.#timeoutHandler) {
      clearTimeout(this.#timeoutHandler);
    }

    this.#timeoutHandler = setTimeout(
      this.#timeoutResolve,
      this.#options.timeout ?? 1000
    );
  }
}
