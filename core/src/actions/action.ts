export type Action<T, P> = {
  event: T;
  response: P;
};

export type EmptyHook = Action<never, void>;
