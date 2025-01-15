export type Request = {
  path: string;
  method: string;
  body?: string;
  headers?: Record<string, string | string[]>;
  query?: Record<string, string | number | boolean>;
  timeout?: number;
};

export type Response = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  bodyEncoding?: string;
  trailers: Record<string, string>;
  timing: {
    duration: number;
  };
};

export type HttpTransaction = {
  id: string;
  request: Request;
  actualResponse: Response;
  possibleResponses: Response[];
};

export type SingleRun = {
  id: string;
  type: 'single';
  transaction: HttpTransaction;
};

export type CollectionRunType = 'sequential' | 'parallel';

export type CollectionRun = {
  id: string;
  type: 'collection';
  collectionRunType: CollectionRunType;
  runs: (SingleRun | CollectionRun)[];
};
