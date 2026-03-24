import type { HttpRequest, HttpResponse } from '../http.js';
import type { HttpParticipantRole } from './rule-meta.js';

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

export interface LoadedTraffic {
  transactions?: CapturedTransaction[];
  traces?: CapturedTrace[];
  metadata?: Record<string, unknown>;
}
