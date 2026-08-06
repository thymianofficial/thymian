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
            '@thymian/plugin-openapi': {
              options: {
                descriptions: [
                  {
                    source: './openapi.yaml',
                  },
                ],
              },
            },
            '@thymian/plugin-sampler': {
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

      it('should validate ThymianConfig with reports array', () => {
        const config: ThymianConfig = {
          plugins: {},
          reports: [{ type: 'spectral', location: './report.json' }],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
      });

      it('should invalidate a reports entry with an empty-string type', () => {
        const config = {
          plugins: {},
          reports: [{ type: '', location: './report.json' }],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(false);
      });

      it('should invalidate a reports entry missing the required type', () => {
        const config = {
          plugins: {},
          reports: [{ location: './report.json' }],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(false);
        if (result.valid === false) {
          expect(result.message).toContain(
            "is missing the required field 'type'",
          );
        }
      });

      it('should validate ThymianConfig with ruleSets', () => {
        const config: ThymianConfig = {
          plugins: {},
          ruleSets: ['@thymian/rules-rfc-9110'],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
      });

      it('should validate ruleSets object entry without a profile', () => {
        const config: ThymianConfig = {
          plugins: {},
          ruleSets: [{ name: '@thymian/rules-rfc-9110' }],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
      });

      it('should validate ruleSets object entry with a valid profile', () => {
        const config: ThymianConfig = {
          plugins: {},
          ruleSets: [{ name: '@thymian/rules-rfc-9110', profile: 'strict' }],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
      });

      it('should validate a mix of bare-string and object ruleSets entries', () => {
        const config: ThymianConfig = {
          plugins: {},
          ruleSets: [
            '@thymian/rules-api-description-validation',
            { name: '@thymian/rules-rfc-9110', profile: 'minimal' },
          ],
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
            '@thymian/plugin-openapi': {
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

      it('should validate config with per-plugin autoload disabled', () => {
        const config: ThymianConfig = {
          plugins: {
            '@thymian/plugin-openapi': {
              autoload: false,
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
              "is missing the required field 'plugins'",
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
            expect(result.message).toContain('/plugins must be an object');
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
            expect(result.message).toContain('/autoload must be a boolean');
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
            expect(result.message).toContain('unexpected property');
            expect(result.message).toContain('unknownProperty');
          }
        });

        it('should invalidate a ruleSets object entry with an unknown profile', () => {
          const config = {
            plugins: {},
            ruleSets: [{ name: '@thymian/rules-rfc-9110', profile: 'bogus' }],
          };

          const result = validateConfig(config);

          expect(result.valid).toBe(false);
        });

        it('should invalidate a ruleSets object entry missing name', () => {
          const config = {
            plugins: {},
            ruleSets: [{ profile: 'recommended' }],
          };

          const result = validateConfig(config);

          expect(result.valid).toBe(false);
        });

        it('should invalidate a ruleSets object entry with additional properties', () => {
          const config = {
            plugins: {},
            ruleSets: [{ name: '@thymian/rules-rfc-9110', extra: true }],
          };

          const result = validateConfig(config);

          expect(result.valid).toBe(false);
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
            expect(result.message).toContain('is missing the required field');
          }
        });
      });
    });
  });
});
