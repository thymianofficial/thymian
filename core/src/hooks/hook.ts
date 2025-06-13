export type Hook<T, P> = {
  args: T;
  returnType: P;
};

export type EmptyHook = Hook<[], void>;
