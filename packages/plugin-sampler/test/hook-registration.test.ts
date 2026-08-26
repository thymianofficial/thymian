import { describe, expect, it, vi } from 'vitest';

import {
  afterAll,
  afterEach,
  authorize,
  beforeAll,
  beforeEach,
  defineSample,
} from '../src/hooks/hook-api.js';
import {
  HOOK_KINDS,
  HOOK_REGISTRATION,
  hookCreationLog,
  isHookRegistration,
} from '../src/hooks/hook-registration.js';

const noop = async (value: unknown): Promise<unknown> => value;

describe('the registration contract', () => {
  it('produces inert, non-callable, frozen data objects', () => {
    const registration = beforeEach('GET /a -> 200', noop);

    expect(typeof registration).toBe('object');
    expect(typeof registration).not.toBe('function');
    expect(Object.isFrozen(registration)).toBe(true);
  });

  it('brands every kind with the global-registry symbol', () => {
    const registrations = [
      defineSample('GET /a -> 200', () => undefined),
      beforeEach('GET /a -> 200', noop),
      afterEach('GET /a -> 200', noop),
      authorize(noop),
      authorize('GET /a -> 200', noop),
      beforeAll(() => undefined),
      afterAll(() => undefined),
    ];

    for (const registration of registrations) {
      expect(
        (registration as unknown as Record<PropertyKey, unknown>)[
          HOOK_REGISTRATION
        ],
      ).toBe(true);
      expect(isHookRegistration(registration)).toBe(true);
      expect(HOOK_KINDS.has(registration.kind)).toBe(true);
    }
  });

  it('uses `Symbol.for`, so a second evaluation of the module agrees', () => {
    // The realm boundary in miniature: a symbol looked up from the process-wide
    // registry — which is what a second evaluation of the runtime module under
    // jiti would produce — is the same symbol.
    expect(Symbol.for('@thymian/plugin-sampler.hook-registration')).toBe(
      HOOK_REGISTRATION,
    );

    const asIfFromAnotherRealm = Object.freeze({
      kind: 'beforeEach',
      order: 0,
      target: 'GET /a -> 200',
      callback: noop,
      [Symbol.for('@thymian/plugin-sampler.hook-registration')]: true,
    });

    expect(isHookRegistration(asIfFromAnotherRealm)).toBe(true);
  });

  it('keeps the creation log on a globalThis slot, not in module scope', () => {
    const fromGlobal = (globalThis as unknown as Record<PropertyKey, unknown>)[
      Symbol.for('@thymian/plugin-sampler.hook-creation-log')
    ];

    // A module-scope log would be invisible here, which is exactly how the
    // plugin would come to read `0` from its own realm forever.
    expect(fromGlobal).toBe(hookCreationLog());
  });

  it('stamps a monotonically increasing order and records each creation', () => {
    const log = hookCreationLog();
    log.created.length = 0;

    const first = beforeEach('GET /a -> 200', noop);
    const second = afterEach('GET /a -> 200', noop);
    const third = beforeAll(() => undefined);

    expect(second.order).toBeGreaterThan(first.order);
    expect(third.order).toBeGreaterThan(second.order);
    expect(log.created).toEqual([first, second, third]);
  });

  it('represents the global authorize hook as `target: undefined`', () => {
    const global = authorize(noop);
    const targeted = authorize('GET /a -> 200', noop);

    expect(global.kind).toBe('authorize');
    expect(global).toMatchObject({ target: undefined });
    expect(targeted).toMatchObject({ target: 'GET /a -> 200' });
  });

  it('gives run-scoped registrations no target property at all', () => {
    // The loader switches on `kind` first *because* of this: probing for a
    // `target` key would be reading a shape that does not exist.
    expect('target' in beforeAll(() => undefined)).toBe(false);
    expect('target' in afterAll(() => undefined)).toBe(false);
  });

  it('rejects the second argument of authorize when it is not a callback', () => {
    expect(() =>
      (authorize as unknown as (target: unknown) => unknown)('GET /a -> 200'),
    ).toThrow(TypeError);
  });

  /**
   * The mirror image of the check above: round 1 added `requireCallback`
   * everywhere, but nothing guarded the **target** slot of the one overloaded
   * factory. `authorize` dispatched on `typeof targetOrCallback === 'function'`,
   * so `authorize(SELECTORS.login, fn)` after a rename — the ordinary way a
   * selector constant goes missing — fell through to `target: undefined`, which
   * *is* the global form. A hook the user aimed at one endpoint authorized every
   * transaction in the API, with `hasErrors: false` and only a `logger.debug`
   * line. Dispatch is on **arity** now: two arguments always mean targeted.
   */
  it('rejects a two-argument authorize whose target is missing', () => {
    expect(() =>
      (authorize as unknown as (t: unknown, c: unknown) => unknown)(
        undefined,
        noop,
      ),
    ).toThrow(TypeError);
  });

  it('rejects a two-argument authorize whose target is a function', () => {
    // The same dispatch bug from the other side: this bound the *first*
    // function as the global authorize hook and silently discarded the second.
    // A function is never a `HookTarget`.
    expect(() =>
      (authorize as unknown as (t: unknown, c: unknown) => unknown)(noop, noop),
    ).toThrow(TypeError);
  });

  it('names the missing target rather than the missing callback', () => {
    expect(() =>
      (authorize as unknown as (t: unknown, c: unknown) => unknown)(
        undefined,
        noop,
      ),
    ).toThrow(/no target/);
  });

  /**
   * `authorize` checked because it is overloaded; the other five did not, and a
   * one-argument `beforeEach(fn)` is the more plausible mistake — it type-checks
   * nowhere but runs fine in a plain `.js` hook file. Unchecked it stored
   * `target: fn, callback: undefined`, fell through to the *filter* branch of
   * `resolveTargeting` and reported `matched none of the N loaded
   * transaction(s)`, with the function's own source text dumped into the
   * diagnostic anchor by `describeTarget`'s `String(target)` fallback: a message
   * about a filter the user never wrote.
   */
  it.each([
    ['defineSample', defineSample],
    ['beforeEach', beforeEach],
    ['afterEach', afterEach],
  ])('rejects a one-argument %s(fn)', (_name, factory) => {
    expect(() =>
      (factory as unknown as (target: unknown) => unknown)(noop),
    ).toThrow(TypeError);
  });

  it.each([
    ['beforeAll', beforeAll],
    ['afterAll', afterAll],
  ])('rejects %s with a non-callable argument', (_name, factory) => {
    expect(() =>
      (factory as unknown as (callback: unknown) => unknown)('not a function'),
    ).toThrow(TypeError);
  });

  it('names the argument it wants, not the shape it got', () => {
    expect(() =>
      (beforeEach as unknown as (target: unknown) => unknown)(noop),
    ).toThrow(/beforeEach\(target, callback\) needs a function/);
  });
});

describe('isHookRegistration', () => {
  it('rejects functions without calling them', () => {
    const helper = vi.fn(() => {
      throw new Error('a helper export must never be invoked');
    });

    expect(isHookRegistration(helper)).toBe(false);
    expect(helper).not.toHaveBeenCalled();
  });

  it('rejects a *callable* that carries the brand', () => {
    // The load-bearing half of "functions are never invoked": a branded callable
    // must be refused structurally, before any property is read, or a user's
    // exported function could be mistaken for a registration and later called.
    const brandedCallable = Object.assign(
      () => {
        throw new Error('a branded function must never be invoked');
      },
      { kind: 'beforeEach', order: 0, [HOOK_REGISTRATION]: true },
    );

    expect(isHookRegistration(brandedCallable)).toBe(false);
  });

  it('rejects a branded class instance whose constructor is callable', () => {
    class Pretender {
      readonly kind = 'beforeEach';
      readonly [HOOK_REGISTRATION] = true;
    }

    // An *instance* is an object, so this one legitimately passes — the brand is
    // the contract, not the prototype. The class itself must not.
    expect(isHookRegistration(new Pretender())).toBe(true);
    expect(isHookRegistration(Pretender)).toBe(false);
  });

  it('rejects a plain object that merely carries a kind string', () => {
    // Without the brand, `export const config = { kind: 'authorize' }` would
    // become a hook.
    expect(isHookRegistration({ kind: 'authorize' })).toBe(false);
    expect(isHookRegistration({ kind: 'beforeEach', callback: noop })).toBe(
      false,
    );
  });

  it('rejects a same-keyed brand carrying anything other than `true`', () => {
    for (const value of [1, 'true', {}, null, undefined]) {
      expect(
        isHookRegistration({
          kind: 'beforeEach',
          [HOOK_REGISTRATION]: value,
        }),
      ).toBe(false);
    }
  });

  it('rejects primitives and null', () => {
    for (const value of [null, undefined, 0, '', 'beforeEach', true, 7n]) {
      expect(isHookRegistration(value)).toBe(false);
    }
  });

  it('tolerates an export whose property access throws', () => {
    const hostile = new Proxy(
      {},
      {
        get(): never {
          throw new Error('boom');
        },
      },
    );

    expect(isHookRegistration(hostile)).toBe(false);
  });

  it('tolerates a throwing accessor on a plain object', () => {
    const hostile = {};
    Object.defineProperty(hostile, HOOK_REGISTRATION, {
      get(): never {
        throw new Error('boom');
      },
    });

    expect(isHookRegistration(hostile)).toBe(false);
  });
});

describe('the creation log slot', () => {
  const KEY = Symbol.for('@thymian/plugin-sampler.hook-creation-log');

  it('never calls a `getStore` a hook file supplied', () => {
    // `recordCreation` runs on the creation path, so whatever it calls runs
    // while the user's module body is still executing. A slot is user-writable
    // by design (that is the only way two realms reach one log), so `scope` may
    // be an accessor that passes the identity check on its first read and hands
    // back something else afterwards. Calling *that* is running user code to
    // decide where a creation goes.
    const original = Reflect.getOwnPropertyDescriptor(globalThis, KEY);
    const called: string[] = [];
    const real = hookCreationLog().scope;
    let reads = 0;

    Reflect.defineProperty(globalThis, KEY, {
      configurable: true,
      writable: true,
      value: {
        nextOrder: 0,
        created: [],
        get scope() {
          reads += 1;

          return reads === 1
            ? real
            : {
                run: () => undefined,
                getStore: () => {
                  called.push('getStore');

                  return undefined;
                },
              };
        },
        set scope(value: unknown) {
          /* silently dropped */
        },
      },
    });

    try {
      beforeEach('GET /a -> 200', noop);
    } finally {
      Reflect.deleteProperty(globalThis, KEY);

      if (original) {
        Reflect.defineProperty(globalThis, KEY, original);
      }
    }

    // Both halves, because `called` staying empty is also what a `recordCreation`
    // that was never reached would look like. `reads` proves the poisoned
    // accessor really was consulted, and the registration proves the creation
    // path ran to the end.
    expect(reads).toBeGreaterThan(0);
    expect(called).toEqual([]);
    expect(hookCreationLog().scope).toBe(real);
  });
});
