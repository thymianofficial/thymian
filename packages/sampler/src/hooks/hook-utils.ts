export type ParameterType = string | number | null | boolean;

export type EndpointRequest = {
  body: unknown;
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

export type Endpoints = Record<
  string,
  {
    req: EndpointRequest;
    res: {
      body: unknown;
      statusCode: number;
      headers: Record<string, unknown>;
    };
  }
>;

export interface HookUtils<E extends Endpoints = Record<string, never>> {
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

  request<R extends keyof E>(
    req: R,
    args: E[R]['req'],
    options?: {
      runHooks?: boolean;
      authorize?: boolean;
      forStatusCode?: number;
    },
  ): Promise<E[R]['res']>;

  randomString(length?: number): string;
}
