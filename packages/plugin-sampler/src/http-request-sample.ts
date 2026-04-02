import { isRecord } from '@thymian/core';

export type InlineContentSource = {
  $content: unknown;
};

export type FileContentSource = {
  $encoding: string;
  $buffer: Buffer;
  $ext: string;
};

export type ContentSource = InlineContentSource | FileContentSource;

export type HttpRequestSample = {
  origin: string;
  path: string;
  method: string;
  authorize: boolean;
  bodyEncoding?: string;
  headers: Record<string, ContentSource>;
  cookies: Record<string, ContentSource>;
  pathParameters: Record<string, ContentSource>;
  query: Record<string, ContentSource>;
  body?: ContentSource;
};

export function isFileContentSource(
  source: unknown,
): source is FileContentSource {
  return (
    isRecord(source) &&
    '$buffer' in source &&
    '$encoding' in source &&
    '$ext' in source
  );
}

export function isInlineContentSource(
  source: unknown,
): source is InlineContentSource {
  return isRecord(source) && '$content' in source;
}
