import { describe, expect, it } from 'vitest';

import rule from './server-must-not-generate-content-for-205-response.rule.js';

describe('must-not-generate-content-for-205-response', () => {
  it('should have error severity', () => {
    expect(rule.meta.severity).toBe('error');
  });
});
