import dm from '@fastify/deepmerge';
import eventemitter from 'eventemitter2';

import type { RegisterPluginEvent } from './events/register-plugin.event.js';
import type {
  AggregateStrategy,
  CollectStrategy,
  HookStrategy,
} from './hook-strategies.js';
import type { CloseHook } from './hooks/close.hook.js';
import type { EmptyHook } from './hooks/hook.js';
import type { LoadFormatHook } from './hooks/load-format.hook.js';
import type { Logger } from './logger/logger.js';
import { NoopLogger } from './logger/noop.logger.js';
import { ThymianError } from './thymian.error.js';

const deepmerge = dm();

export interface ThymianHooks {
  'core.close': CloseHook;
  'core.ready': EmptyHook;
  'core.load-format': LoadFormatHook;
}

export interface ThymianEvents {
  'core.error': ThymianError;
  'core.register': RegisterPluginEvent;
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

export type HookResult<T> = T extends undefined | never | null | void
  ? {
      score?: number;
    }
  : {
      score?: number;
      result: T;
    };

export type RunHookReturnType<
  Strategy extends HookStrategy,
  ReturnType
> = Strategy extends CollectStrategy
  ? ReturnType[]
  : Strategy extends AggregateStrategy<ReturnType, infer T>
  ? T
  : ReturnType;

export class ThymianEmitter {
  #timeoutHandler: NodeJS.Timeout | undefined;
  #timeoutResolve!: () => void;
  readonly #timeoutPromise: Promise<void>;
  readonly #logger: Logger;
  readonly #emitter: eventemitter.EventEmitter2;
  readonly #options: ThymianEmitterOptions;

  constructor(
    logger: Logger,
    options: Partial<ThymianEmitterOptions> = {},
    emitter = new eventemitter.EventEmitter2({
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
          HookResult<ThymianHooks[Event]['returnType']>
        >
      : ThymianListerAsyncFn<any, HookResult<any>>
  ): this {
    this.#emitter.on(String(event), listener as eventemitter.ListenerFn, {
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
    arg?: Event extends keyof ThymianEvents ? ThymianEvents[Event] : any
  ): void {
    try {
      this.#resetTimeout();
      this.#emitter.emit(event, arg);
    } catch (e) {
      throw new ThymianError(`Error while emitting event ${event}.`, e);
    }
  }

  async runHook<
    Hook extends ThymianHook,
    Strategy extends HookStrategy = CollectStrategy
  >(
    event: Hook,
    arg?: Hook extends keyof ThymianHooks ? ThymianHooks[Hook]['arg'] : any,
    strategy?: Strategy
  ): Promise<
    RunHookReturnType<
      Strategy,
      Hook extends keyof ThymianHooks ? ThymianHooks[Hook]['returnType'] : any
    >
  > {
    try {
      this.#resetTimeout();
      const results = (await this.#emitter.emitAsync(
        String(event),
        arg
      )) as HookResult<any>[];

      const str = strategy ?? { type: 'collect' };

      switch (str.type) {
        case 'collect':
          return results
            .filter((r) => 'result' in r)
            .map((r) => r.result) as RunHookReturnType<
            Strategy,
            Hook extends keyof ThymianHooks
              ? ThymianHooks[Hook]['returnType']
              : any
          >;
        case 'vote': {
          const votedResult = results.reduce((max, curr) =>
            (curr.score ?? 0) > (max.score ?? 0) ? curr : max
          );

          return 'result' in votedResult ? votedResult.result : undefined;
        }
        case 'aggregate':
          return str.merger(results);
        case 'deep-merge':
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          return (
            results
              .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-expect-error
              .reduce((acc, curr) => deepmerge(acc, curr.result), {})
          );
      }
    } catch (e) {
      throw new ThymianError(`Error while running hook ${event}.`, e);
    }
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

const emitter = new ThymianEmitter(new NoopLogger());

const result = await emitter.runHook('core.load-format');
