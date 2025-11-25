export type Action<T, P> = {
  event: T;
  response: P;
};
