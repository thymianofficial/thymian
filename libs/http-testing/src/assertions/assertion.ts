export type AssertionResult = {
  message: string;
  failed?: boolean;
};
export type AssertionFnResult = void | AssertionResult | AssertionResult[];

export type AssertionFn<T> = (
  args: T
) => AssertionFnResult | Promise<AssertionFnResult>;
