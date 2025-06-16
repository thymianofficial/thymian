import { EventEmitter2, type ListenerFn } from 'eventemitter2';

import type { Logger } from './logger/logger.js';
import type { ThymianError } from './thymian.error.js';

// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
export interface ThymianHooks {}

export interface ThymianEvents {
  'core.error': ThymianError;
}

export type ThymianListerFn<Arg> = (arg: Arg) => void | Promise<void>;

export type ThymianListerAsyncFn<Arg, ReturnType> = (
  arg: Arg
) => Promise<ReturnType> | ReturnType;

export type ThymianEmitterOptions = {
  timeout: number;
};

export type ThymianEvent = keyof ThymianEvents | (string & {});

export type ThymianHook = keyof ThymianHooks | (string & {});

export class ThymianEmitter {
  #timeoutHandler: NodeJS.Timeout | undefined;
  #timeoutResolve!: () => void;
  readonly #timeoutPromise: Promise<void>;
  readonly #logger: Logger;
  readonly #emitter: EventEmitter2;
  readonly #options: ThymianEmitterOptions;

  constructor(
    logger: Logger,
    options: Partial<ThymianEmitterOptions> = {},
    emitter = new EventEmitter2({
      wildcard: true,
      delimiter: '.',
      maxListeners: 100,
    })
  ) {
    this.#logger = logger;
    this.#options = {
      timeout: 1000,
      ...options,
    };
    this.#emitter = emitter;
    this.#timeoutPromise = new Promise((resolve) => {
      this.#timeoutResolve = resolve;
    });
    this.#resetTimeout();
  }

  onEvent<Event extends ThymianEvent>(
    event: Event,
    listener: ThymianListerFn<
      Event extends keyof ThymianEvents ? ThymianEvents[Event] : any
    >
  ): this {
    this.#emitter.on(event, listener);

    return this;
  }

  onHook<Event extends ThymianHook>(
    event: Event,
    listener: Event extends keyof ThymianHooks
      ? ThymianListerAsyncFn<
          ThymianHooks[Event]['arg'],
          ThymianHooks[Event]['returnType']
        >
      : ThymianListerAsyncFn<any, any>
  ): this {
    this.#emitter.on(String(event), listener as ListenerFn, {
      async: true,
      promisify: true,
      nextTick: false,
    });

    return this;
  }

  emitError(err: ThymianError): void {
    this.emitEvent('core.error', err);
  }

  onError(fn: ThymianListerFn<ThymianError>): void {
    this.onEvent('core.error', fn);
  }

  emitEvent<Event extends ThymianEvent>(
    event: Event,
    arg: Event extends keyof ThymianEvents ? ThymianEvents[Event] : any
  ): void {
    this.#resetTimeout();
    this.#logger.debug(`Emitting event "${event}".`);
    this.#emitter.emit(event, arg);
  }

  runHook<Event extends ThymianHook>(
    event: Event,
    arg?: Event extends keyof ThymianHooks ? ThymianHooks[Event]['arg'] : any
  ): Promise<
    Event extends keyof ThymianHooks
      ? ThymianHooks[Event]['returnType'][]
      : any[]
  > {
    this.#resetTimeout();
    this.#logger.debug(`Emitting event "${event}".`);
    return this.#emitter.emitAsync(String(event), arg) as Promise<
      Event extends keyof ThymianHooks
        ? ThymianHooks[Event]['returnType'][]
        : any[]
    >;
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
      this.#options.timeout
    );
  }
}
