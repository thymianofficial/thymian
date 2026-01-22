import type { HttpRequestTemplate } from '@thymian/core';

import {
  type ContentSource,
  type HttpRequestSample,
  isFileContentSource,
  isInlineContentSource,
} from './http-request-sample.js';

export function transformContentSource<T extends string | unknown>(
  source: ContentSource,
): T {
  if (isInlineContentSource(source)) {
    return source.$content as T;
  } else if (isFileContentSource(source)) {
    return Buffer.from(source.$buffer).toString(
      source.$encoding as BufferEncoding,
    ) as T;
  }

  throw new Error('Unknown content source type .' + source);
}

export function transformParameters(
  parameters: Record<string, ContentSource>,
): Record<string, unknown> {
  return Object.entries(parameters).reduce(
    (acc: Record<string, unknown>, [name, source]) => {
      acc[name] = transformContentSource(source);

      return acc;
    },
    {},
  );
}

export function requestSampleToRequestTemplate(
  sample: HttpRequestSample,
): HttpRequestTemplate {
  const template: HttpRequestTemplate = {
    authorize: sample.authorize,
    cookies: transformParameters(sample.cookies),
    headers: transformParameters(sample.headers),
    method: sample.method,
    origin: sample.origin,
    path: sample.path,
    pathParameters: transformParameters(sample.pathParameters),
    query: transformParameters(sample.query),
    bodyEncoding: sample.bodyEncoding,
  };

  if (sample.body) {
    template.bodyEncoding = sample.bodyEncoding;
    template.body = transformContentSource(sample.body);
  }

  return template;
}
