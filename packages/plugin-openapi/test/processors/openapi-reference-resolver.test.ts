import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';
import { describe, expect, it } from 'vitest';

import {
  resolveOpenApiReference,
  resolveOpenApiReferenceOnce,
} from '../../src/processors/openapi-reference-resolver.js';

function documentWith(
  components: OpenApiV31.ComponentsObject,
): OpenApiV31.Document {
  return {
    openapi: '3.1.0',
    info: { title: 'Refs', version: '1.0.0' },
    components,
  };
}

describe('resolveOpenApiReference', () => {
  it('follows a chain of three internal refs to the object at its end', () => {
    const target = { get: { responses: {} } };
    const document = documentWith({
      pathItems: {
        A: { $ref: '#/components/pathItems/B' },
        B: { $ref: '#/components/pathItems/C' },
        C: target,
      },
    });

    expect(
      resolveOpenApiReference(
        { $ref: '#/components/pathItems/A' },
        document,
        'path item',
      ),
    ).toBe(target);
  });

  it('throws when the refs form a cycle', () => {
    const document = documentWith({
      pathItems: {
        A: { $ref: '#/components/pathItems/B' },
        B: { $ref: '#/components/pathItems/A' },
      },
    });

    expect(() =>
      resolveOpenApiReference(
        { $ref: '#/components/pathItems/A' },
        document,
        'path item',
      ),
    ).toThrow(
      'Could not resolve internal path item reference "#/components/pathItems/A": the refs form a cycle.',
    );
  });

  it('throws naming an external ref met in the middle of a chain', () => {
    const document = documentWith({
      pathItems: {
        A: { $ref: './other.yaml' },
      },
    });

    expect(() =>
      resolveOpenApiReference(
        { $ref: '#/components/pathItems/A' },
        document,
        'path item',
      ),
    ).toThrow(
      'Only internal path item references are supported but got "./other.yaml".',
    );
  });
});

describe('resolveOpenApiReferenceOnce', () => {
  it('stops at one level, keeping a target that is itself a ref', () => {
    const middle = { $ref: '#/components/schemas/C', description: 'kept' };
    const document = documentWith({
      schemas: { B: middle, C: { type: 'string' } },
    });

    expect(
      resolveOpenApiReferenceOnce(
        { $ref: '#/components/schemas/B' },
        document,
        'schema',
      ),
    ).toBe(middle);
  });
});
