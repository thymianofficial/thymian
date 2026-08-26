import { describe, expect, it } from 'vitest';

import { parseReportFlag } from '../../src/flags/report-flag.js';
import { parseSpecFlag } from '../../src/flags/spec-flag.js';
import { parseTrafficFlag } from '../../src/flags/traffic-flag.js';

describe('flag parsers', () => {
  describe('parseSpecFlag', () => {
    it('should parse a spec flag with type and location', () => {
      const result = parseSpecFlag('openapi:./openapi.yaml');

      expect(result).toEqual({
        type: 'openapi',
        location: './openapi.yaml',
      });
    });

    it('should throw for missing type prefix', () => {
      expect(() => parseSpecFlag('./openapi.yaml')).toThrow(
        'Invalid --spec format: "./openapi.yaml"',
      );
    });

    it('should parse multiple types', () => {
      expect(parseSpecFlag('asyncapi:./asyncapi.yaml')).toEqual({
        type: 'asyncapi',
        location: './asyncapi.yaml',
      });
    });

    it('should handle colons in location path', () => {
      const result = parseSpecFlag('openapi:C:\\Users\\api\\openapi.yaml');

      expect(result).toEqual({
        type: 'openapi',
        location: 'C:\\Users\\api\\openapi.yaml',
      });
    });

    it('should handle URL-style locations with colons', () => {
      const result = parseSpecFlag(
        'openapi:https://example.com/api/openapi.yaml',
      );

      expect(result).toEqual({
        type: 'openapi',
        location: 'https://example.com/api/openapi.yaml',
      });
    });
  });

  describe('parseReportFlag', () => {
    it('should parse a report flag with type and location', () => {
      const result = parseReportFlag('spectral:./report.json');

      expect(result).toEqual({
        type: 'spectral',
        location: './report.json',
      });
    });

    it('should handle URL-style locations with colons', () => {
      const result = parseReportFlag(
        'spectral:https://example.com/ci/report.json',
      );

      expect(result).toEqual({
        type: 'spectral',
        location: 'https://example.com/ci/report.json',
      });
    });

    it('should handle colons in Windows-style location paths', () => {
      const result = parseReportFlag('spectral:C:\\reports\\report.json');

      expect(result).toEqual({
        type: 'spectral',
        location: 'C:\\reports\\report.json',
      });
    });

    it('should throw for missing colon separator (no bare-path fallback)', () => {
      expect(() => parseReportFlag('./report.json')).toThrow(
        'Invalid --report format: "./report.json"',
      );
    });

    it('should throw for empty type', () => {
      expect(() => parseReportFlag(':./report.json')).toThrow(
        'Invalid --report format: ":./report.json"',
      );
    });

    it('should throw for empty location', () => {
      expect(() => parseReportFlag('spectral:')).toThrow(
        'Invalid --report format: "spectral:"',
      );
    });
  });

  describe('parseTrafficFlag', () => {
    it('should parse a single traffic flag', () => {
      const result = parseTrafficFlag('har:./traffic.har');

      expect(result).toEqual({ type: 'har', location: './traffic.har' });
    });

    it('should handle colons in location path', () => {
      const result = parseTrafficFlag('har:https://example.com/traffic.har');

      expect(result).toEqual({
        type: 'har',
        location: 'https://example.com/traffic.har',
      });
    });

    it('should throw for missing colon separator', () => {
      expect(() => parseTrafficFlag('har-traffic.har')).toThrow(
        'Invalid --traffic format: "har-traffic.har"',
      );
    });
  });
});

describe('parseTypedInput (shared first-colon parser, ADR-0017)', () => {
  it('splits on the first colon only', async () => {
    const { parseTypedInput } = await import('../../src/flags/typed-input.js');

    expect(
      parseTypedInput('thymian:https://host:8443/report.json', '--base', 'x:y'),
    ).toEqual({ type: 'thymian', location: 'https://host:8443/report.json' });
  });

  it('names the flag and example in its error message', async () => {
    const { parseTypedInput } = await import('../../src/flags/typed-input.js');

    expect(() =>
      parseTypedInput('./report.json', '--head', 'thymian:./report.json'),
    ).toThrow(
      'Invalid --head format: "./report.json". Expected format: <type>:<location> (e.g. thymian:./report.json).',
    );
    expect(() => parseTypedInput(':x', '--base', 'e')).toThrow(
      'Invalid --base format',
    );
    expect(() => parseTypedInput('x:', '--base', 'e')).toThrow(
      'Invalid --base format',
    );
  });
});
