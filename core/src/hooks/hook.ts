export type Hook<T, P> = {
  arg: T;
  returnType: P;
};

export type EmptyHook = Hook<never, void>;
