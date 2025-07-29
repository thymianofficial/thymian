import { randomUUID } from 'node:crypto';

import deepmerge from '@fastify/deepmerge';
import chalk from 'chalk';
import {
  filter,
  firstValueFrom,
  merge,
  Subject,
  take,
  takeUntil,
  timer,
  toArray,
} from 'rxjs';

import type { ThymianActionName, ThymianActions } from '../actions/index.js';
import type { ThymianEventName } from '../events/index.js';
import type { Logger } from '../logger/logger.js';
import { isThymianError, ThymianBaseError } from '../thymian.error.js';
import type {
  ActionEventPayload,
  ResponseEventPayload,
  ThymianActionEvent,
  ThymianResponseEvent,
} from './action-event.js';
import type { ErrorName, ThymianErrorEvent } from './error.js';
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
  payload: EventPayload<Event>
) => Promise<void> | void;

export type ActionHandler<Name extends ThymianActionName> = (
  payload: ActionEventPayload<Name>,
  ctx: ActionContext<Name>
) => Promise<void> | void;

export type ThymianEmitterOptions = {
  timeout: number;
  traceEvents: boolean;
};

export type EmitActionOptions = {
  timeout: number;
  strategy: 'first' | 'collect' | 'deep-merge';
};

export type EmitActionArgs<
  Name extends ThymianActionName,
  Options extends Partial<EmitActionOptions>
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
  private readonly options: ThymianEmitterOptions;

  readonly source: string;

  readonly #events = new Subject<
    ThymianEvent<ThymianEventName> | ThymianActionEvent<ThymianActionName>
  >();

  readonly #responses: Subject<ThymianResponseEvent<ThymianActionName>>;

  readonly #errors: Subject<ThymianErrorEvent<ErrorName>>;

  readonly #listeners: Map<ThymianActionName, number>;

  readonly #completed: Set<string>;

  constructor(
    private readonly logger: Logger,
    state: EmitterState,
    options: Partial<ThymianEmitterOptions> = {}
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

    if (this.options.traceEvents) {
      this.#events.subscribe(this.logEvent('event'));
      this.#responses.subscribe(this.logEvent('response event'));
    }
  }

  on<Name extends ThymianEventName>(
    name: Name,
    handler: EventHandler<Name>
  ): void {
    this.#events
      .pipe(filter(isEventWithName(name)))
      .subscribe(async (event) => {
        try {
          await handler(event.payload);
        } catch (e) {
          if (e instanceof ThymianBaseError) {
            this.#errors.next({
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
              timestamp: Date.now(),
              source: this.source,
            });
          } else {
            this.#errors.next({
              error: new ThymianBaseError(
                `Error while calling event handler for event "${event.name}" from "${event.source}".`,
                { cause: e }
              ),
              name,
              timestamp: Date.now(),
              source: this.source,
            });
          }
        }
      });
  }

  emit<Name extends ThymianEventName>(
    name: Name,
    payload: EventPayload<Name>
  ): void {
    this.#events.next({
      name,
      payload,
      timestamp: Date.now(),
      source: this.source,
    });
  }

  onAction<Name extends ThymianActionName>(
    name: Name,
    handler: ActionHandler<Name>
  ): void {
    this.#listeners.set(name, (this.#listeners.get(name) ?? 0) + 1);

    this.#events
      .pipe(filter(isActionEventWithName(name)))
      .subscribe(async (event) => {
        const ctx = this.createActionContext(name, event.correlationId);

        try {
          await handler(event.payload, ctx);
        } catch (e) {
          if (e instanceof ThymianBaseError) {
            this.#errors.next({
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
              correlationId: event.correlationId,
              timestamp: Date.now(),
              source: this.source,
            });
          } else {
            this.#errors.next({
              error: new ThymianBaseError(
                `Error while calling action handler for action "${event.name}" from "${event.source}".`,
                { cause: e }
              ),
              name,
              correlationId: event.correlationId,
              timestamp: Date.now(),
              source: this.source,
            });
          }
        }
      });
  }

  async emitAction<
    Name extends ThymianActionName,
    Options extends Partial<EmitActionOptions> = { strategy: 'collect' }
  >(
    ...args: EmitActionArgs<Name, Options>
  ): Promise<
    Options['strategy'] extends 'collect'
      ? ResponseEventPayload<Name>[]
      : ResponseEventPayload<Name>
  > {
    const [name, payload, options] = args;
    const opts: EmitActionOptions = {
      timeout: this.options.timeout,
      strategy: 'collect',
      ...(options ?? {}),
    };

    const event: ThymianActionEvent<Name> = {
      correlationId: randomUUID(),
      name,
      payload,
      timestamp: Date.now(),
      source: this.source,
    };

    const numOfListeners = this.#listeners.get(name) ?? 0;
    const takeNum = opts.strategy === 'first' ? 1 : numOfListeners;

    const responsesAndErrors = merge(
      this.#responses.pipe(filter(isResponseOf(name, event.correlationId))),
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      this.#errors.pipe(filter(isResponseOf(name, event.correlationId)))
    ).pipe(takeUntil(timer(opts.timeout)), take(takeNum), toArray());

    queueMicrotask(() => {
      this.#events.next(event);
    });

    const results = (await firstValueFrom(responsesAndErrors)) as (
      | ThymianResponseEvent<Name>
      | ThymianErrorEvent<Name>
    )[];

    const errors = results.filter((r) =>
      Object.hasOwn(r, 'error')
    ) as ThymianErrorEvent<Name>[];

    if (errors.length > 0 && typeof errors[0] !== 'undefined') {
      this.logger.error(
        `Received ${errors.length} error event${
          errors.length > 1 ? 's' : ''
        } from ${errors
          .map((err) => `"${err.source}"`)
          .join(', ')} while waiting for response event(s) for event "${name}".`
      );

      const { error } = errors[0];

      if (error instanceof ThymianBaseError) {
        throw error;
      } else {
        throw new ThymianBaseError(error.message, error.options);
      }
    }

    if (opts.strategy !== 'first' && results.length !== numOfListeners) {
      this.logger.debug(
        `Expected ${numOfListeners} response events for event "${name}" but got ${results.length}.`
      );
    }

    const payloads = (results as ThymianResponseEvent<Name>[])
      .map((msg) => msg.payload)
      .filter(Boolean);

    this.#completed.add(event.correlationId);

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
      }
    );
  }

  private createActionContext<Name extends ThymianActionName>(
    name: Name,
    correlationId: string
  ): ActionContext<Name> {
    return {
      error: (error) => {
        if (error instanceof ThymianBaseError) {
          this.#errors.next({
            correlationId,
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
            timestamp: Date.now(),
            source: this.source,
          });
        } else {
          this.#errors.next({
            error: new ThymianBaseError(
              `Error while calling action handler for action "${name}".`,
              { cause: error }
            ),
            name,
            correlationId,
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
        | ThymianErrorEvent<ErrorName>
    ) => {
      this.logger.trace(
        `${chalk.bold(event.source)} with ${type} ${chalk.bold(
          event.name
        )} at ${new Date(event.timestamp)
          .toISOString()
          .replace('T', ' ')
          .replace('Z', '')}`
      );
    };
  }
}
