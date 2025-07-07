import { randomUUID } from 'node:crypto';

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

import type { Logger } from '../logger/logger.js';
import { ThymianBaseError, type ThymianError } from '../thymian.error.js';
import type {
  ActionEventPayload,
  ResponseEventPayload,
  ThymianActionEvent,
  ThymianActionName,
  ThymianActions,
  ThymianResponseEvent,
} from './actions.js';
import type { ErrorName, ThymianErrorEvent } from './error.js';
import type { EventPayload, ThymianEvent, ThymianEventName } from './events.js';
import {
  isActionEventWithName,
  isEventWithName,
  isResponseOf,
} from './utils.js';
import deepmerge from '@fastify/deepmerge';
import { TextLogger } from '../logger/text.logger.js';

const dm = deepmerge({ all: true });

export type ActionContext<Name extends ThymianActionName> = {
  reply: (payload: ResponseEventPayload<Name>) => void;
  error: (error: ThymianError) => void;
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

export class ThymianEmitter {
  private readonly options: ThymianEmitterOptions;

  readonly #events = new Subject<
    ThymianEvent<ThymianEventName> | ThymianActionEvent<ThymianActionName>
  >();

  readonly #responses = new Subject<ThymianResponseEvent<ThymianActionName>>();

  readonly #errors = new Subject<ThymianErrorEvent<ErrorName>>();

  readonly #listeners = new Map<ThymianActionName, number>();

  readonly #completed = new Set<string>();

  constructor(
    private readonly logger: Logger,
    options: Partial<ThymianEmitterOptions> = {}
  ) {
    this.options = {
      timeout: 1000,
      ...options,
    };

    this.#responses
      .pipe(filter((response) => this.#completed.has(response.correlationId)))
      .subscribe((response) => {
        this.logger.error(`Got response for event ${response.name} but `);
      });
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
          this.#errors.next({
            error: new ThymianBaseError(
              `Error while calling handler for event: ${event}.`,
              { cause: e }
            ),
            name: 'thymian.error',
            timestamp: Date.now(),
          });
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
          this.#errors.next({
            error: new ThymianBaseError(
              `Error while calling handler for event: ${event}.`,
              { cause: e }
            ),
            name,
            correlationId: event.correlationId,
            timestamp: Date.now(),
          });
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

    if (errors.length > 0) {
      throw new ThymianBaseError(
        'Received error event while waiting for response event(s) for event ' +
          name
      );
    }

    if (opts.strategy !== 'first' && results.length !== numOfListeners) {
      this.logger.debug(
        `Expected ${numOfListeners} response events but got ${results.length}`
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

  private createActionContext<Name extends ThymianActionName>(
    name: Name,
    correlationId: string
  ): ActionContext<Name> {
    return {
      error: (error) => {
        this.#errors.next({
          correlationId,
          error: error,
          name,
          timestamp: Date.now(),
        });
      },
      reply: (payload) => {
        this.#responses.next({
          correlationId,
          name,
          payload,
          timestamp: Date.now(),
        } as ThymianResponseEvent<Name>);
      },
    };
  }
}
