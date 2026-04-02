import { describe, expect, it } from 'vitest';

import type { ThymianConfig } from '../src/thymian-config.js';
import { validateConfig } from '../src/validate-config.js';

describe('validate-config', () => {
  describe('validateConfig', () => {
    describe('happy path', () => {
      it('should validate valid ThymianConfig with empty plugins', () => {
        const config: ThymianConfig = {
          plugins: {},
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
      });

      it('should validate valid ThymianConfig with plugins', () => {
        const config: ThymianConfig = {
          plugins: {
            '@thymian/openapi': {
              options: {
                descriptions: [
                  {
                    source: './openapi.yaml',
                  },
                ],
              },
            },
            '@thymian/sampler': {
              options: {
                path: './samples',
              },
            },
          },
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
      });

      it('should validate ThymianConfig with autoload field', () => {
        const config: ThymianConfig = {
          autoload: true,
          plugins: {},
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
      });

      it('should validate ThymianConfig with specifications array', () => {
        const config: ThymianConfig = {
          plugins: {},
          specifications: [{ type: 'openapi', location: './openapi.yaml' }],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
      });

      it('should validate ThymianConfig with traffic array', () => {
        const config: ThymianConfig = {
          plugins: {},
          traffic: [{ type: 'har', location: './traffic.har' }],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
      });

      it('should validate ThymianConfig with ruleSets', () => {
        const config: ThymianConfig = {
          plugins: {},
          ruleSets: ['@thymian/rfc-9110-rules'],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
      });

      it('should validate ThymianConfig with ruleSeverity', () => {
        const config: ThymianConfig = {
          plugins: {},
          ruleSeverity: 'error',
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
      });

      it('should validate ThymianConfig with ruleSeverity set to hint', () => {
        const config: ThymianConfig = {
          plugins: {},
          ruleSeverity: 'hint',
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
      });

      it('should validate ThymianConfig with rules', () => {
        const config: ThymianConfig = {
          plugins: {},
          rules: {
            'rfc9110/content-type-required': 'warn',
          },
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should validate config with autoload false', () => {
        const config: ThymianConfig = {
          autoload: false,
          plugins: {},
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
      });

      it('should validate config with plugin options', () => {
        const config: ThymianConfig = {
          plugins: {
            '@thymian/openapi': {
              options: {
                descriptions: [
                  {
                    source: './openapi.yaml',
                  },
                ],
              },
            },
          },
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
      });

      describe('error handling', () => {
        it('should invalidate config without plugins field', () => {
          const config = {
            autoload: true,
          };

          const result = validateConfig(config);

          expect(result.valid).toBe(false);
          if (result.valid === false) {
            expect(result.message).toContain(
              "must have required property 'plugins'",
            );
          }
        });

        it('should invalidate config with wrong type for plugins', () => {
          const config = {
            plugins: 'not-an-object',
          };

          const result = validateConfig(config);

          expect(result.valid).toBe(false);
          if (result.valid === false) {
            expect(result.message).toContain('must be object');
          }
        });

        it('should invalidate config with wrong type for autoload', () => {
          const config = {
            plugins: {},
            autoload: 'yes',
          };

          const result = validateConfig(config);

          expect(result.valid).toBe(false);
          if (result.valid === false) {
            expect(result.message).toContain('must be boolean');
          }
        });

        it('should invalidate config with additional root properties', () => {
          const config = {
            plugins: {},
            unknownProperty: 'value',
          };

          const result = validateConfig(config);

          expect(result.valid).toBe(false);
          if (result.valid === false) {
            expect(result.message).toContain(
              'must NOT have additional properties',
            );
          }
        });

        it('should invalidate null config', () => {
          const result = validateConfig(null);

          expect(result.valid).toBe(false);
        });

        it('should invalidate undefined config', () => {
          const result = validateConfig(undefined);

          expect(result.valid).toBe(false);
        });

        it('should return error message for invalid config', () => {
          const config = {
            autoload: 123,
          };

          const result = validateConfig(config);

          expect(result.valid).toBe(false);
          if (result.valid === false) {
            expect(result.message).toBeDefined();
            expect(result.message.length).toBeGreaterThan(0);
          }
        });
      });

      describe('multiple errors', () => {
        it('should report all validation errors', () => {
          const config = {
            autoload: 'invalid',
          };

          const result = validateConfig(config);

          expect(result.valid).toBe(false);
          if (result.valid === false) {
            expect(result.message).toContain('must have required property');
          }
        });
      });
    });
  });
});
