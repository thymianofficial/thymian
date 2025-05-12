export type HttpTestContext = Record<PropertyKey, unknown>;

export type HttpTestContextFn = (...args: unknown[]) => unknown;
