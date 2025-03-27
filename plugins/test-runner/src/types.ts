export interface HttpTest {
  id: string;
  name: string;
  description?: string;
  context?: Record<string, unknown>;
  start: number;
  end?: number;
  skip: boolean;
  transactions: HttpTransaction | HttpTransactionCollection;
  errors: RuntimeError[];
  results: TestResult[];
}

export type TestResult = {
  message: string;
  status: 'hint' | 'warn' | 'error';
};

export type RuntimeError = {
  name: string;
  message: string;
};

export type Request = {
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string | string[]>;
  query?: Record<string, string | number | boolean>;
  timeout?: number;
};

export type Response = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body?: string;
  bodyEncoding?: string;
  trailers: Record<string, string>;
};

export type HttpTransaction = {
  id: string;
  request: Request;
  actualResponse: Response;
  possibleResponses: Response[];
};

export type CollectionType = 'sequential' | 'parallel';

export type HttpTransactionCollection = {
  id: string;
  type: CollectionType;
  transactions: (HttpTransaction | HttpTransactionCollection)[];
};

export function isCollection(
  transaction: HttpTransaction | HttpTransactionCollection
): transaction is HttpTransactionCollection {
  return 'type' in transaction;
}
