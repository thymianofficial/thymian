import type { Rule } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import {
  createSeverityRuleFilter,
  mergeRuleSets,
  mergeSpecifications,
  mergeTraffic,
  resolveRuleSeverity,
  toRuleSetInputs,
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
    it('should merge config and flag rule sets, defaulting to recommended', () => {
      const result = mergeRuleSets(
        ['@thymian/rules-rfc-9110'],
        ['@thymian/custom-rules'],
      );

      expect(result).toEqual([
        { name: '@thymian/rules-rfc-9110', profile: 'recommended' },
        { name: '@thymian/custom-rules', profile: 'recommended' },
      ]);
    });

    it('should normalize a bare string entry to the recommended profile', () => {
      expect(mergeRuleSets(['@thymian/rules-rfc-9110'], undefined)).toEqual([
        { name: '@thymian/rules-rfc-9110', profile: 'recommended' },
      ]);
    });

    it('should normalize an object entry without profile to recommended', () => {
      expect(
        mergeRuleSets([{ name: '@thymian/rules-rfc-9110' }], undefined),
      ).toEqual([{ name: '@thymian/rules-rfc-9110', profile: 'recommended' }]);
    });

    it('should preserve an explicit profile on an object entry', () => {
      expect(
        mergeRuleSets(
          [{ name: '@thymian/rules-rfc-9110', profile: 'strict' }],
          undefined,
        ),
      ).toEqual([{ name: '@thymian/rules-rfc-9110', profile: 'strict' }]);
    });

    it('should treat flag rule sets as recommended bare strings', () => {
      expect(mergeRuleSets(undefined, ['@thymian/rules-rfc-9110'])).toEqual([
        { name: '@thymian/rules-rfc-9110', profile: 'recommended' },
      ]);
    });

    it('should deduplicate by name, keeping the first profile selection', () => {
      const result = mergeRuleSets(
        [
          { name: '@thymian/rules-rfc-9110', profile: 'strict' },
          '@thymian/custom-rules',
        ],
        ['@thymian/rules-rfc-9110', '@thymian/other-rules'],
      );

      expect(result).toEqual([
        { name: '@thymian/rules-rfc-9110', profile: 'strict' },
        { name: '@thymian/custom-rules', profile: 'recommended' },
        { name: '@thymian/other-rules', profile: 'recommended' },
      ]);
    });

    it('should return empty array when both are undefined', () => {
      expect(mergeRuleSets(undefined, undefined)).toEqual([]);
    });
  });

  describe('toRuleSetInputs', () => {
    it('splits normalized selections into rules and ruleProfiles', () => {
      const result = toRuleSetInputs([
        { name: '@thymian/rules-rfc-9110', profile: 'strict' },
        { name: '@thymian/custom-rules', profile: 'recommended' },
      ]);

      expect(result.rules).toEqual([
        '@thymian/rules-rfc-9110',
        '@thymian/custom-rules',
      ]);
      expect(result.ruleProfiles).toEqual({
        '@thymian/rules-rfc-9110': 'strict',
        '@thymian/custom-rules': 'recommended',
      });
    });

    it('returns empty structures for an empty selection', () => {
      expect(toRuleSetInputs([])).toEqual({ rules: [], ruleProfiles: {} });
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
