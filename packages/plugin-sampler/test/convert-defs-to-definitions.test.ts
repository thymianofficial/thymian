import { describe, expect, it } from 'vitest';

import { convertDefsToDefinitions } from '../src/hooks/generate-request-types.js';

describe('generateRequestTypes', () => {
  it('test', () => {
    const result = convertDefsToDefinitions({
      $ref: '#/definitions/CreateHookOption/properties/config',
      $defs: {
        CreateHookOptionConfig: {
          description:
            'CreateHookOptionConfig has all config options in it\n' +
            'required are "content_type" and "url" Required',
          type: 'object',
          additionalProperties: [Object],
          'x-go-package': 'code.gitea.io/gitea/modules/structs',
          required: [],
        },
        CreateHookOption: {
          description: 'CreateHookOption options when create a hook',
          type: 'object',
          required: [Array],
          properties: [Object],
          'x-go-package': 'code.gitea.io/gitea/modules/structs',
          additionalProperties: true,
        },
      },
    });

    console.log(result);
  });
});
