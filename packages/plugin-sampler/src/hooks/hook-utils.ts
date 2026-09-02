export type ParameterType = string | number | null | boolean;

export type EndpointRequest = {
  body?: unknown;
  headers?: Record<PropertyKey, string | string[] | undefined>;
  query?: Record<PropertyKey, ParameterType>;
  cookies?: Record<PropertyKey, ParameterType>;
  path?: Record<
    PropertyKey,
    | ParameterType
    | ParameterType[]
    | Record<string, ParameterType | ParameterType[]>
  >;
};

export type EndpointResponse = {
  body: unknown;
  statusCode: number;
  headers: Record<string, unknown>;
};

export type Endpoints = Record<
  string,
  {
    req: EndpointRequest;
    res: EndpointResponse;
  }
>;

/** Options for a cross-endpoint request. */
export type RequestOptions = {
  /**
   * Run the target's own `beforeEach` → `authorize` → `afterEach` pipeline, so
   * a seeding call behaves like the real run. Default `true`; `false` is the
   * raw-seeding escape, and the way out of a cycle.
   */
  runHooks?: boolean;
  /**
   * Force authorization on or off for this call, overriding the target's own
   * `authorize` flag. Authorization still needs a registered authorize hook.
   */
  authorize?: boolean;
};

/**
 * The typed setters.
 *
 * They coexist with direct mutation and do exactly the same thing: a setter is
 * a place for the compiler to know the name and the value type, not a different
 * mechanism. Both write into the same request object.
 *
 * In an `afterEach` hook the request has already been sent, so a setter there
 * changes nothing observable — the surface stays uniform rather than throwing.
 */
export interface HookSetters {
  setHeader(name: string, value: string | string[] | undefined): void;
  setQuery(name: string, value: unknown): void;
  setPathParam(name: string, value: unknown): void;
  setCookie(name: string, value: unknown): void;
  setBody(body: unknown): void;
  setAuthorize(authorize: boolean): void;
}

/**
 * Reads a file next to the hook that asks for it.
 *
 * A relative path resolves against the **hook file's own directory**, not the
 * working directory: a fixture lives beside the hook that uses it, and a hook
 * must keep working when the run starts somewhere else.
 */
export interface HookFileHelpers {
  readFile(path: string): Buffer;
  readText(path: string, encoding?: BufferEncoding): string;
  readJson<T = unknown>(path: string): T;
}

export interface HookUtils<E extends Endpoints = Record<string, never>>
  extends HookSetters, HookFileHelpers {
  skip(message: string): never;

  fail(message: string): never;

  info(message: string): void;

  warn(message: string, details?: string): void;

  assertionSuccess(message: string, assertion?: string): void;

  assertionFailure(
    message: string,
    details?: { assertion?: string; expected?: unknown; actual?: unknown },
  ): void;

  timeout(message: string, durationMs: number): void;

  /**
   * Call another Transaction, addressed by its Selector.
   *
   * Keyed by Selector and resolved through the transaction catalog, so the keys
   * the committed types carry and the strings resolved at run time are the same
   * strings by construction. There is no `forStatusCode`: the Selector already
   * carries the status.
   */
  request<R extends keyof E>(
    selector: R,
    args?: E[R]['req'],
    options?: RequestOptions,
  ): Promise<E[R]['res']>;

  randomString(length?: number): string;
}
