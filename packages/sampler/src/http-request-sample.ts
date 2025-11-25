import type {
  HttpRequestTemplate,
  ThymianHttpTransaction,
} from '@thymian/core';

export type HttpRequestSample = {
  meta: {
    bodyPath?: string;
    source: ThymianHttpTransaction;
  };
  request: HttpRequestTemplate;
};
