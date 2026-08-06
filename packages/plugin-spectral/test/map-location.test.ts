import { ThymianFormat } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { mapLocation } from '../src/map-location.js';
import type { SpectralResult } from '../src/spectral-types.js';

function result(overrides: Partial<SpectralResult> = {}): SpectralResult {
  return {
    code: 'operation-description',
    message: 'Operation "description" must be present and non-empty string.',
    severity: 1,
    path: ['paths', '/users', 'get'],
    range: {
      start: { line: 6, character: 4 },
      end: { line: 8, character: 20 },
    },
    source: 'api.yaml',
    ...overrides,
  };
}

function formatWithNodeAt(
  line: number,
  path = 'api.yaml',
  requestPath = '/users',
): { format: ThymianFormat; nodeId: string } {
  const format = new ThymianFormat();
  const [nodeId] = format.addHttpTransaction(
    createHttpRequest({
      path: requestPath,
      sourceName: path,
      sourceLocation: {
        path,
        // openapi loc-mappers produce 1-based line/column positions
        position: { line, column: 3, offset: 0 },
      },
    }),
    createHttpResponse(),
    path,
  );

  return { format, nodeId };
}

describe('mapLocation', () => {
  it('maps to the format node whose position is nearest at-or-before the finding', () => {
    const { format, nodeId } = formatWithNodeAt(5);

    // finding at 0-based line 6 => 1-based 7, node at 1-based 5 => match
    const location = mapLocation(result(), format);

    expect(location).toEqual({
      type: 'thymianFormat',
      elementType: 'node',
      elementId: nodeId,
      pointer: '',
    });
  });

  it('picks the nearest of several candidate nodes in the same source', () => {
    const format = new ThymianFormat();
    format.addHttpTransaction(
      createHttpRequest({
        path: '/early',
        sourceName: 'api.yaml',
        sourceLocation: {
          path: 'api.yaml',
          position: { line: 5, column: 3, offset: 0 },
        },
      }),
      createHttpResponse(),
      'api.yaml',
    );
    const [nearestId] = format.addHttpTransaction(
      createHttpRequest({
        path: '/late',
        sourceName: 'api.yaml',
        sourceLocation: {
          path: 'api.yaml',
          position: { line: 10, column: 3, offset: 0 },
        },
      }),
      createHttpResponse(),
      'api.yaml',
    );

    const location = mapLocation(
      result({
        range: {
          start: { line: 11, character: 4 },
          end: { line: 11, character: 20 },
        },
      }),
      format,
    );

    expect(location).toEqual(
      expect.objectContaining({ type: 'thymianFormat', elementId: nearestId }),
    );
  });

  it('matches Windows-style absolute sources against POSIX node paths', () => {
    const { format, nodeId } = formatWithNodeAt(5);

    const location = mapLocation(
      result({ source: 'C:\\Users\\dev\\project\\api.yaml' }),
      format,
    );

    expect(location).toEqual(
      expect.objectContaining({ type: 'thymianFormat', elementId: nodeId }),
    );
  });

  it('matches when the finding source is an absolute variant of the node path', () => {
    const { format, nodeId } = formatWithNodeAt(5);

    const location = mapLocation(
      result({ source: '/home/user/project/api.yaml' }),
      format,
    );

    expect(location).toEqual(
      expect.objectContaining({ type: 'thymianFormat', elementId: nodeId }),
    );
  });

  it('falls back to a file location when the finding is before every node position', () => {
    const { format } = formatWithNodeAt(5);

    const location = mapLocation(
      result({
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 10 },
        },
      }),
      format,
    );

    expect(location).toEqual({
      type: 'file',
      path: 'api.yaml',
      line: 1,
      column: 1,
    });
  });

  it('falls back to a file location when the source matches no node', () => {
    const { format } = formatWithNodeAt(5);

    const location = mapLocation(result({ source: 'other.yaml' }), format);

    expect(location).toEqual({
      type: 'file',
      path: 'other.yaml',
      line: 7,
      column: 5,
    });
  });

  it('falls back to a file location without a format', () => {
    const location = mapLocation(result(), undefined);

    expect(location).toEqual({
      type: 'file',
      path: 'api.yaml',
      line: 7,
      column: 5,
    });
  });

  it('falls back to a custom location from joined path segments without a source', () => {
    const location = mapLocation(result({ source: undefined }), undefined);

    expect(location).toEqual({
      type: 'custom',
      value: 'paths./users.get',
    });
  });

  it('uses a stable custom fallback when neither source nor path exist', () => {
    const location = mapLocation(
      result({ source: undefined, path: [] }),
      undefined,
    );

    expect(location).toEqual({ type: 'custom', value: 'unknown' });
  });
});
