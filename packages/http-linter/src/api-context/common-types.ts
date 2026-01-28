import type { RuleViolationLocation } from '../rule/rule-violation.js';

export type CommonHttpRequest = {
  origin: string;
  path: string;
  method: string;
  headers: string[];
  queryParameters: string[];
  cookies: string[];
  mediaType: string;
  body: boolean;
  location: RuleViolationLocation;
};

export type CommonHttpResponse = {
  statusCode: number;
  mediaType: string;
  headers: string[];
  body: boolean;
  trailers: string[];
  location: RuleViolationLocation;
};
