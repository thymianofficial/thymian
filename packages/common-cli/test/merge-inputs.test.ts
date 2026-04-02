import type { Rule } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import {
  createSeverityRuleFilter,
  mergeRuleSets,
  mergeSpecifications,
  mergeTraffic,
  resolveRuleSeverity,
} from '../src/merge-inputs.js';

function createMockRule(severity: 'off' | 'error' | 'warn' | 'hint'): Rule {
  return {
    meta: {
      name: `test-rule-${severity}`,
      type: ['static'],
      options: {},
      severity,
    },
  } as Rule;
}

describe('merge-inputs', () => {
  describe('mergeSpecifications', () => {
    it('should merge config and flag specs', () => {
      const result = mergeSpecifications(
        [{ type: 'openapi', location: './a.yaml' }],
        [{ type: 'openapi', location: './b.yaml' }],
      );

      expect(result).toEqual([
        { type: 'openapi', location: './a.yaml' },
        { type: 'openapi', location: './b.yaml' },
      ]);
    });

    it('should handle undefined config', () => {
      const result = mergeSpecifications(undefined, [
        { type: 'openapi', location: './b.yaml' },
      ]);

      expect(result).toEqual([{ type: 'openapi', location: './b.yaml' }]);
    });

    it('should handle undefined flags', () => {
      const result = mergeSpecifications(
        [{ type: 'openapi', location: './a.yaml' }],
        undefined,
      );

      expect(result).toEqual([{ type: 'openapi', location: './a.yaml' }]);
    });

    it('should return empty array when both are undefined', () => {
      expect(mergeSpecifications(undefined, undefined)).toEqual([]);
    });
  });

  describe('mergeTraffic', () => {
    it('should merge config and flag traffic', () => {
      const result = mergeTraffic(
        [{ type: 'har', location: './a.har' }],
        [{ type: 'har', location: './b.har' }],
      );

      expect(result).toEqual([
        { type: 'har', location: './a.har' },
        { type: 'har', location: './b.har' },
      ]);
    });

    it('should return empty array when both are undefined', () => {
      expect(mergeTraffic(undefined, undefined)).toEqual([]);
    });
  });

  describe('mergeRuleSets', () => {
    it('should merge config and flag rule sets', () => {
      const result = mergeRuleSets(
        ['@thymian/rules-rfc-9110'],
        ['@thymian/custom-rules'],
      );

      expect(result).toEqual([
        '@thymian/rules-rfc-9110',
        '@thymian/custom-rules',
      ]);
    });

    it('should deduplicate rule set names', () => {
      const result = mergeRuleSets(
        ['@thymian/rules-rfc-9110', '@thymian/custom-rules'],
        ['@thymian/rules-rfc-9110', '@thymian/other-rules'],
      );

      expect(result).toEqual([
        '@thymian/rules-rfc-9110',
        '@thymian/custom-rules',
        '@thymian/other-rules',
      ]);
    });

    it('should handle undefined config', () => {
      const result = mergeRuleSets(undefined, ['@thymian/rules-rfc-9110']);

      expect(result).toEqual(['@thymian/rules-rfc-9110']);
    });

    it('should handle undefined flags', () => {
      const result = mergeRuleSets(['@thymian/rules-rfc-9110'], undefined);

      expect(result).toEqual(['@thymian/rules-rfc-9110']);
    });

    it('should return empty array when both are undefined', () => {
      expect(mergeRuleSets(undefined, undefined)).toEqual([]);
    });
  });

  describe('resolveRuleSeverity', () => {
    it('should return flag value when both flag and config are set', () => {
      expect(resolveRuleSeverity('warn', 'hint')).toBe('hint');
    });

    it('should return config value when flag is undefined', () => {
      expect(resolveRuleSeverity('warn', undefined)).toBe('warn');
    });

    it('should return default "error" when both are undefined', () => {
      expect(resolveRuleSeverity(undefined, undefined)).toBe('error');
    });

    it('should ignore invalid flag values and use config', () => {
      expect(resolveRuleSeverity('warn', 'invalid')).toBe('warn');
    });

    it('should ignore invalid flag values and fall back to default', () => {
      expect(resolveRuleSeverity(undefined, 'invalid')).toBe('error');
    });

    it('should accept "off" as a valid severity', () => {
      expect(resolveRuleSeverity(undefined, 'off')).toBe('off');
    });
  });

  describe('createSeverityRuleFilter', () => {
    const errorRule = createMockRule('error');
    const warnRule = createMockRule('warn');
    const hintRule = createMockRule('hint');
    const offRule = createMockRule('off');

    it('should filter to only error rules when severity is "error"', () => {
      const filter = createSeverityRuleFilter('error');

      expect(filter(errorRule)).toBe(true);
      expect(filter(warnRule)).toBe(false);
      expect(filter(hintRule)).toBe(false);
      expect(filter(offRule)).toBe(false);
    });

    it('should filter to error and warn rules when severity is "warn"', () => {
      const filter = createSeverityRuleFilter('warn');

      expect(filter(errorRule)).toBe(true);
      expect(filter(warnRule)).toBe(true);
      expect(filter(hintRule)).toBe(false);
      expect(filter(offRule)).toBe(false);
    });

    it('should include all active rules when severity is "hint"', () => {
      const filter = createSeverityRuleFilter('hint');

      expect(filter(errorRule)).toBe(true);
      expect(filter(warnRule)).toBe(true);
      expect(filter(hintRule)).toBe(true);
      expect(filter(offRule)).toBe(false);
    });

    it('should exclude all rules when severity is "off"', () => {
      const filter = createSeverityRuleFilter('off');

      expect(filter(errorRule)).toBe(false);
      expect(filter(warnRule)).toBe(false);
      expect(filter(hintRule)).toBe(false);
      expect(filter(offRule)).toBe(false);
    });
  });
});
