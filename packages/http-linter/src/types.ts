import {
  type HttpRequest,
  httpRequestToLabel,
  type HttpResponse,
  httpResponseToLabel,
  httpTransactionToLabel,
} from '@thymian/core';

import type { HttpParticipantRole } from './rule/rule-meta.js';

export type CapturedHttpRequest = {
  data: HttpRequest;
  meta: {
    role?: HttpParticipantRole;
  };
};

export type CapturedHttpResponse = {
  data: HttpResponse;
  meta: {
    role?: HttpParticipantRole;
  };
};

export type CapturedTransaction = {
  request: CapturedHttpRequest;
  response: CapturedHttpResponse;
};

export type CapturedTrace = CapturedTransaction[];
