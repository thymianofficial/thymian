import { randomUUID } from 'node:crypto';

import deepmerge from '@fastify/deepmerge';
import chalk from 'chalk';
import {
  debounceTime,
  filter,
  firstValueFrom,
  map,
  merge,
  race,
  startWith,
  Subject,
  take,
  takeUntil,
  timer,
  toArray,
} from 'rxjs';

import type { ThymianActionName, ThymianActions } from '../actions/index.js';
import type { ThymianEventName } from '../events/index.js';
import type { Logger } from '../logger/logger.js';
import { NoopLogger } from '../logger/noop.logger.js';
import {
  isThymianError,
  ThymianBaseError,
  type ThymianError,
} from '../thymian.error.js';
import type {
  ActionEventPayload,
  ResponseEventPayload,
  ThymianActionEvent,
  ThymianResponseEvent,
} from './action-event.js';
import type { ErrorName, ThymianErrorEvent } from './error-event.js';
import type { EventPayload, ThymianEvent } from './events.js';
import {
  isActionEventWithName,
  isEventWithName,
  isResponseOf,
} from './utils.js';

const dm = deepmerge({ all: true });

export type ActionContext<Name extends ThymianActionName> = {
  reply: (payload: ResponseEventPayload<Name>) => void;
  error: (error: unknown) => void;
};

export type EventHandler<Event extends ThymianEventName> = (
  payload: EventPayload<Event>,
) => Promise<void> | void;

export type ActionHandler<Name extends ThymianActionName> = (
  payload: ActionEventPayload<Name>,
  ctx: ActionContext<Name>,
) => Promise<void> | void;

export type ThymianEmitterOptions = {
  timeout: number;
  traceEvents: boolean;
};

export type EmitActionOptions = {
  timeout: number;
  strategy: 'first' | 'collect' | 'deep-merge';
  strict: boolean;
};

export type EmitActionReturnType<
  Name extends ThymianActionName,
  Options extends Partial<EmitActionOptions>,
> = Options['strict'] extends false
  ? Options['strategy'] extends 'collect' | undefined
    ? ResponseEventPayload<Name>[] | undefined
    : ResponseEventPayload<Name> | undefined
  : Options['strategy'] extends 'collect' | undefined
    ? ResponseEventPayload<Name>[]
    : ResponseEventPayload<Name>;

export type EmitActionArgs<
  Name extends ThymianActionName,
  Options extends Partial<EmitActionOptions>,
> = ThymianActions[Name]['event'] extends void | undefined | null | never
  ? [name: Name, payload?: undefined, options?: Options]
  : [name: Name, payload: ThymianActions[Name]['event'], options?: Options];

export type EmitterState = {
  source: string;
  events: Subject<
    ThymianEvent<ThymianEventName> | ThymianActionEvent<ThymianActionName>
  >;
  responses: Subject<ThymianResponseEvent<ThymianActionName>>;
  errors: Subject<ThymianErrorEvent<ErrorName>>;
  listeners: Map<ThymianActionName, number>;
  completed: Set<string>;
};

export class ThymianEmitter {
  static #hasBeenInitialized = false;

  private readonly options: ThymianEmitterOptions;

  readonly source: string;

  readonly #events = new Subject<
    ThymianEvent<ThymianEventName> | ThymianActionEvent<ThymianActionName>
  >();

  readonly #responses: Subject<ThymianResponseEvent<ThymianActionName>>;

  readonly #errors: Subject<ThymianErrorEvent<ErrorName>>;

  readonly #listeners: Map<ThymianActionName, number>;

  // TODO: this is a problem
  readonly #completed: Set<string>;

  /**
   * Multiplier for the hard timeout limit relative to the idle debounce time.
   */
  private static MAX_WAIT_MULTIPLIER = 5;

  constructor(
    private readonly logger: Logger = new NoopLogger(),
    state: EmitterState = ThymianEmitter.emptyEmitterState(),
    options: Partial<ThymianEmitterOptions> = {},
  ) {
    this.options = {
      timeout: 1000,
      traceEvents: false,
      ...options,
    };

    this.source = state.source;
    this.#responses = state.responses;
    this.#events = state.events;
    this.#errors = state.errors;
    this.#listeners = state.listeners;
    this.#completed = state.completed;

    if (!ThymianEmitter.#hasBeenInitialized) {
      this.#events.subscribe(this.logEvent('event'));
      this.#responses.subscribe(this.logEvent('response event'));

      ThymianEmitter.#hasBeenInitialized = true;
    }
  }

  static emptyEmitterState(source = ''): EmitterState {
    return {
      source,
      events: new Subject(),
      responses: new Subject(),
      errors: new Subject(),
      listeners: new Map(),
      completed: new Set(),
    };
  }

  async shutdown(idleTimeMs = this.options.timeout): Promise<void> {
    await Promise.all([
      this.shutdownSubject(this.#events, idleTimeMs, 'events'),
      this.shutdownSubject(this.#responses, idleTimeMs, 'responses'),
      this.shutdownSubject(this.#errors, idleTimeMs, 'errors'),
    ]);
  }

  private async shutdownSubject(
    subject: Subject<any>,
    waitFor: number,
    name = '',
    timeout = waitFor * ThymianEmitter.MAX_WAIT_MULTIPLIER,
  ): Promise<void> {
    return new Promise((resolve) => {
      race([
        subject.pipe(
          startWith(null),
          debounceTime(waitFor),
          take(1),
          map(() => 'idle'),
        ),
        timer(timeout).pipe(map(() => 'timeout')),
      ]).subscribe((reason) => {
        this.logger.debug(
          `Complete subject${name ? ' ' + name : name} due to ${reason}.`,
        );
        resolve();
      });
    });
  }

  completeSubjects(): void {
    this.#events.complete();
    this.#responses.complete();
    this.#errors.complete();
  }

  on<Name extends ThymianEventName>(
    name: Name,
    handler: EventHandler<Name>,
  ): void {
    this.#events
      .pipe(filter(isEventWithName(name)))
      .subscribe(async (event) => {
        try {
          await handler(event.payload);
        } catch (e) {
          if (e instanceof ThymianBaseError) {
            this.#errors.next({
              id: randomUUID(),
              error: e,
              name,
              timestamp: Date.now(),
              source: this.source,
              correlationId: event.id,
            });
          } else if (isThymianError(e)) {
            const error = new ThymianBaseError(e.message, {
              ...e.options,
              name: e.name,
            });

            this.#errors.next({
              error,
              name,
              timestamp: Date.now(),
              source: this.source,
              correlationId: event.id,
              id: randomUUID(),
            });
          } else {
            this.#errors.next({
              error: new ThymianBaseError(
                `Error while calling event handler for event "${event.name}" from "${event.source}".`,
                { cause: e },
              ),
              name,
              timestamp: Date.now(),
              source: this.source,
              correlationId: event.id,
              id: randomUUID(),
            });
          }
        }
      });
  }

  emit<Name extends ThymianEventName>(
    name: Name,
    payload: EventPayload<Name>,
  ): void {
    this.#events.next({
      id: randomUUID(),
      name,
      payload,
      timestamp: Date.now(),
      source: this.source,
    });
  }

  emitError(err: ThymianError, name = ''): void {
    let error!: ThymianBaseError;
    if (err instanceof ThymianBaseError) {
      error = err;
    } else if (isThymianError(err)) {
      error = new ThymianBaseError(err.message, {
        ...err.options,
        name: err.name,
      });
    } else {
      error = new ThymianBaseError(
        `Error while emitting error event from "${this.source}".`,
        { cause: err },
      );
    }

    this.#errors.next({
      error,
      id: randomUUID(),
      name: name as ErrorName,
      source: this.source,
      timestamp: Date.now(),
    });
  }

  onAction<Name extends ThymianActionName>(
    name: Name,
    handler: ActionHandler<Name>,
  ): void {
    this.#listeners.set(name, (this.#listeners.get(name) ?? 0) + 1);

    this.#events
      .pipe(filter(isActionEventWithName(name)))
      .subscribe(async (event) => {
        const ctx = this.createActionContext(name, event.id);

        try {
          await handler(event.payload, ctx);
        } catch (e) {
          if (e instanceof ThymianBaseError) {
            this.#errors.next({
              correlationId: event.id,
              id: randomUUID(),
              error: e,
              name,
              timestamp: Date.now(),
              source: this.source,
            });
          } else if (isThymianError(e)) {
            const error = new ThymianBaseError(e.message, {
              ...e.options,
              name: e.name,
            });

            this.#errors.next({
              error,
              name,
              correlationId: event.id,
              timestamp: Date.now(),
              source: this.source,
              id: randomUUID(),
            });
          } else {
            this.#errors.next({
              error: new ThymianBaseError(
                `Error while calling action handler for action "${event.name}" from "${event.source}".`,
                { cause: e },
              ),
              name,
              correlationId: event.id,
              id: randomUUID(),
              timestamp: Date.now(),
              source: this.source,
            });
          }
        }
      });
  }

  async emitAction<
    Name extends ThymianActionName,
    Options extends Partial<EmitActionOptions> = {
      strategy: 'collect';
      strict: true;
    },
  >(
    ...args: EmitActionArgs<Name, Options>
  ): Promise<EmitActionReturnType<Name, Options>> {
    const [name, payload, options] = args;
    const opts: EmitActionOptions = {
      timeout: this.options.timeout,
      strategy: 'collect',
      strict: true,
      ...(options ?? {}),
    };

    if (!this.#listeners.has(name) && !name.startsWith('core.')) {
      if (opts.strict) {
        this.emitError(
          new ThymianBaseError(`No listener for action "${name}" registered.`, {
            suggestions: [
              'Did you forget to call register handler via "onAction" for it?',
            ],
            name: 'NoHandlerRegisteredError',
          }),
        );
      }
      return undefined as EmitActionReturnType<Name, Options>;
    }

    const start = performance.now();
    const event: ThymianActionEvent<Name> = {
      id: randomUUID(),
      name,
      payload,
      timestamp: Date.now(),
      source: this.source,
    };

    const numOfListeners = this.#listeners.get(name) ?? 0;

    const takeNum = opts.strategy === 'first' ? 1 : numOfListeners;

    const responsesAndErrors = merge(
      this.#responses.pipe(filter(isResponseOf(name, event.id))),
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      this.#errors.pipe(filter(isResponseOf(name, event.id))),
    ).pipe(takeUntil(timer(opts.timeout)), take(takeNum), toArray());

    const resultsPromise = firstValueFrom(responsesAndErrors);

    // Yield execution to the event loop.
    // This forces the event emission into the next microtask, ensuring that:
    // 1. The 'resultsPromise' subscription is fully active.
    // 2. The event emission does not run synchronously within the current stack frame.
    await Promise.resolve();

    this.#events.next(event);

    const results = (await resultsPromise) as (
      | ThymianResponseEvent<Name>
      | ThymianErrorEvent<Name>
    )[];

    if (results.length === 0) {
      this.logger.debug(
        `No response event received for action "${name}" within ${opts.timeout}ms.`,
      );
    }

    const errors = results.filter((r) =>
      Object.hasOwn(r, 'error'),
    ) as ThymianErrorEvent<Name>[];

    if (errors.length > 0 && typeof errors[0] !== 'undefined') {
      this.logger.debug(
        `Received ${errors.length} error event${
          errors.length > 1 ? 's' : ''
        } from ${errors
          .map((err) => `"${err.source}"`)
          .join(
            ', ',
          )} while waiting for response event(s) for event "${name}".`,
      );

      const { error } = errors[0];

      if (error instanceof ThymianBaseError) {
        throw error;
      } else {
        throw new ThymianBaseError(error.message, error.options);
      }
    }

    if (opts.strategy !== 'first' && results.length !== numOfListeners) {
      this.logger.warn(
        `Expected ${numOfListeners} response events for event "${name}" but got ${results.length}.`,
      );
    }

    const payloads = (results as ThymianResponseEvent<Name>[]).map(
      (msg) => msg.payload,
    );

    this.#completed.add(event.id);

    const duration = performance.now() - start;

    if (duration > opts.timeout) {
      this.logger.warn(
        `Action "${name}" took ${duration}ms but timeout was set to ${opts.timeout}. Increase the timeout to avoid this warning.`,
      );
    }

    this.logger.debug(
      `Action "${name}" was emitted and processed in ${performance.now() - start}ms.`,
    );

    switch (opts.strategy) {
      case 'first':
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        return payloads[0];
      case 'collect':
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        return payloads;
      case 'deep-merge':
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        return dm(...payloads);
    }
  }

  child(source: string): ThymianEmitter {
    return new ThymianEmitter(
      this.logger.child(source),
      {
        completed: this.#completed,
        errors: this.#errors,
        events: this.#events,
        listeners: this.#listeners,
        responses: this.#responses,
        source,
      },
      {
        ...this.options,
        // we only have to listen to all events once
        traceEvents: false,
      },
    );
  }

  private createActionContext<Name extends ThymianActionName>(
    name: Name,
    correlationId: string,
  ): ActionContext<Name> {
    return {
      error: (error) => {
        if (error instanceof ThymianBaseError) {
          this.#errors.next({
            correlationId,
            id: randomUUID(),
            error: error,
            name,
            timestamp: Date.now(),
            source: this.source,
          });
        } else if (isThymianError(error)) {
          const thymianError = new ThymianBaseError(error.message, {
            ...error.options,
            name: error.name,
          });

          this.#errors.next({
            error: thymianError,
            name,
            correlationId,
            id: randomUUID(),
            timestamp: Date.now(),
            source: this.source,
          });
        } else {
          this.#errors.next({
            error: new ThymianBaseError(
              `Error while calling action handler for action "${name}".`,
              { cause: error },
            ),
            name,
            correlationId,
            id: randomUUID(),
            timestamp: Date.now(),
            source: this.source,
          });
        }
      },
      reply: (payload) => {
        this.#responses.next({
          correlationId,
          name,
          payload,
          timestamp: Date.now(),
          source: this.source,
          id: randomUUID(),
        });
      },
    };
  }

  onError(fn: (error: ThymianErrorEvent<ErrorName>) => void): void {
    this.#errors.subscribe(fn);
  }

  private logEvent(type: 'event' | 'response event') {
    return (
      event:
        | ThymianEvent<ThymianEventName>
        | ThymianActionEvent<ThymianActionName>
        | ThymianResponseEvent<ThymianActionName>
        | ThymianErrorEvent<ErrorName>,
    ) => {
      this.logger.trace(
        `${chalk.bold(event.source)} with ${type} ${chalk.bold(
          event.name,
        )} at ${new Date(event.timestamp)
          .toISOString()
          .replace('T', ' ')
          .replace('Z', '')}`,
      );
    };
  }
}
