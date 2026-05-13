import { describe, expect, it } from 'vitest';

import { convertDefsToDefinitions } from '../src/hooks/generate-request-types.js';

describe('generateRequestTypes', () => {
  it('converts $defs to definitions and rewrites refs', () => {
    const result = convertDefsToDefinitions({
      $ref: '#/$defs/CreateHookOption/properties/config',
      $defs: {
        CreateHookOptionConfig: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
          required: [],
        },
        CreateHookOption: {
          type: 'object',
          required: ['config'],
          properties: {
            config: {
              $ref: '#/$defs/CreateHookOptionConfig',
            },
            fallbacks: {
              type: 'array',
              items: {
                $ref: '#/$defs/CreateHookOptionConfig',
              },
            },
          },
          additionalProperties: true,
        },
      },
    });

    expect(result).toEqual({
      definitions: {
        CreateHookOptionConfig: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
          required: [],
        },
        CreateHookOption: {
          type: 'object',
          required: ['config'],
          properties: {
            config: {
              $ref: '#/definitions/CreateHookOptionConfig',
            },
            fallbacks: {
              type: 'array',
              items: {
                $ref: '#/definitions/CreateHookOptionConfig',
              },
            },
          },
          additionalProperties: true,
        },
      },
      allOf: [
        {
          $ref: '#/definitions/CreateHookOption/properties/config',
        },
      ],
    });
  });

  it('does not rewrite non-reference strings that contain $defs paths', () => {
    const result = convertDefsToDefinitions({
      description: 'See #/$defs/Foo for more details.',
      pattern: '^#/$defs/Foo$',
      examples: ['#/$defs/Foo'],
      properties: {
        config: {
          $ref: '#/$defs/Foo',
        },
      },
      $defs: {
        Foo: {
          type: 'string',
        },
      },
    });

    expect(result).toEqual({
      description: 'See #/$defs/Foo for more details.',
      pattern: '^#/$defs/Foo$',
      examples: ['#/$defs/Foo'],
      properties: {
        config: {
          $ref: '#/definitions/Foo',
        },
      },
      definitions: {
        Foo: {
          type: 'string',
        },
      },
    });
  });
});
