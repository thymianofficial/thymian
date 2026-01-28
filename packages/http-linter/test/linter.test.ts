import { NoopLogger, ThymianFormat } from '@thymian/core';
import type { JSONSchemaType } from '@thymian/core/ajv';
import { describe, expect, it } from 'vitest';

import type { RuleMeta } from '../src/index.js';
import { AbstractLinter } from '../src/linter/abstract-linter.js';

describe('AbstractLinter', () => {
  class TestLinter extends AbstractLinter {
    override runRule(): Promise<boolean> {
      return Promise.resolve(false);
    }
  }

  it('should throw error for duplicated rule', () => {
    const ruleMeta: RuleMeta<never> = {
      name: 'abc',
      type: [],
      options: {} as JSONSchemaType<never>,
      severity: 'off',
    };

    expect(
      () =>
        new TestLinter(
          new NoopLogger(),
          [
            {
              meta: {
                ...ruleMeta,
              },
            },
            {
              meta: {
                ...ruleMeta,
              },
            },
            {
              meta: {
                ...ruleMeta,
                name: 'cba',
              },
            },
          ],
          () => undefined,
          new ThymianFormat(),
          {},
        ),
    ).toThrowError('Duplicate rule names found: abc');
  });
});
