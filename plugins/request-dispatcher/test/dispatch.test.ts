import { describe, it } from 'vitest';
import { NoopLogger, Thymian } from '@thymian/core';
import dispatcherPlugin from '../src/index.js';
import { dispatchHttpRequest } from '../src/dispatch.js';

describe('dispatchHttpRequest', () => {
  it('should work', async () => {
    const res = await dispatchHttpRequest({
      origin: 'http://localhost:8081',
      path: 'tools.descartes.teastore.persistence/rest/users/509',
      method: 'delete',
      headers: {
        accept: 'application/json',
      },
    });
  });
});
