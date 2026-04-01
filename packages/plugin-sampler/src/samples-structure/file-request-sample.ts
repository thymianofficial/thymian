import { isRecord } from '@thymian/core';

export type InlineValue = unknown;

export type FileValue = {
  $file: string;
  $encoding?: string;
};

export type Value = InlineValue | FileValue;

// an HttpRequestSample on disk
export type FileRequestSample = {
  origin: string;
  path: string;
  method: string;
  authorize: boolean;
  bodyEncoding?: string;
  headers: Record<string, Value>;
  cookies: Record<string, Value>;
  pathParameters: Record<string, Value>;
  query: Record<string, Value>;
  body?: Value;
};

export function isFileValue(value: Value): value is FileValue {
  return isRecord(value) && typeof value['$file'] === 'string';
}
