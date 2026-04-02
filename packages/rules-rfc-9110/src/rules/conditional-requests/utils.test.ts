import { describe, expect, it } from 'vitest';

import {
  compareETags,
  compareHttpDates,
  hasInvalidConditionalETagSyntax,
  isStrongETag,
  isValidHttpDate,
  isWeakETag,
  parseConditionalETagHeader,
} from './utils';

describe('isWeakETag', () => {
  it('identifies weak ETags with uppercase W/', () => {
    expect(isWeakETag('W/"123"')).toBe(true);
    expect(isWeakETag('W/"abc"')).toBe(true);
  });

  it('identifies weak ETags with lowercase w/', () => {
    expect(isWeakETag('w/"123"')).toBe(true);
    expect(isWeakETag('w/"abc"')).toBe(true);
  });

  it('identifies weak ETags with leading whitespace', () => {
    expect(isWeakETag(' W/"123"')).toBe(true);
    expect(isWeakETag('  w/"123"')).toBe(true);
  });

  it('identifies strong ETags correctly', () => {
    expect(isWeakETag('"123"')).toBe(false);
    expect(isWeakETag('"abc"')).toBe(false);
    expect(isWeakETag('"W/123"')).toBe(false);
  });

  it('handles empty string', () => {
    expect(isWeakETag('')).toBe(false);
  });
});

describe('isStrongETag', () => {
  it('identifies strong ETags correctly', () => {
    expect(isStrongETag('"123"')).toBe(true);
    expect(isStrongETag('"abc"')).toBe(true);
    expect(isStrongETag('"W/123"')).toBe(true);
  });

  it('identifies weak ETags as not strong', () => {
    expect(isStrongETag('W/"123"')).toBe(false);
    expect(isStrongETag('w/"123"')).toBe(false);
    expect(isStrongETag(' W/"123"')).toBe(false);
  });

  it('is the inverse of isWeakETag', () => {
    const testCases = ['"123"', 'W/"123"', 'w/"abc"', ' W/"test"', '"strong"'];
    testCases.forEach((etag) => {
      expect(isStrongETag(etag)).toBe(!isWeakETag(etag));
    });
  });
});

describe('isValidHttpDate', () => {
  describe('IMF-fixdate format', () => {
    it('validates correct IMF-fixdate format', () => {
      expect(isValidHttpDate('Sun, 06 Nov 1994 08:49:37 GMT')).toBe(true);
      expect(isValidHttpDate('Mon, 01 Jan 2024 00:00:00 GMT')).toBe(true);
      expect(isValidHttpDate('Fri, 31 Dec 1999 23:59:59 GMT')).toBe(true);
    });

    it('rejects invalid IMF-fixdate format', () => {
      expect(isValidHttpDate('Sun, 6 Nov 1994 08:49:37 GMT')).toBe(false); // Single digit day
      expect(isValidHttpDate('Sunday, 06 Nov 1994 08:49:37 GMT')).toBe(false); // Full day name
      expect(isValidHttpDate('Sun, 06 Nov 94 08:49:37 GMT')).toBe(false); // 2-digit year
    });
  });

  describe('RFC 850 format', () => {
    it('validates correct RFC 850 format', () => {
      expect(isValidHttpDate('Sunday, 06-Nov-94 08:49:37 GMT')).toBe(true);
      expect(isValidHttpDate('Monday, 01-Jan-24 00:00:00 GMT')).toBe(true);
    });

    it('rejects invalid RFC 850 format', () => {
      expect(isValidHttpDate('Sun, 06-Nov-94 08:49:37 GMT')).toBe(false); // Abbreviated day
      expect(isValidHttpDate('Sunday, 6-Nov-94 08:49:37 GMT')).toBe(false); // Single digit day
    });
  });

  describe('asctime format', () => {
    it('validates correct asctime format', () => {
      expect(isValidHttpDate('Sun Nov  6 08:49:37 1994')).toBe(true);
      expect(isValidHttpDate('Mon Jan  1 00:00:00 2024')).toBe(true);
      expect(isValidHttpDate('Fri Dec 31 23:59:59 1999')).toBe(true);
    });

    it('rejects invalid asctime format', () => {
      expect(isValidHttpDate('Sunday Nov  6 08:49:37 1994')).toBe(false); // Full day name
      expect(isValidHttpDate('Sun Nov 6 08:49:37 1994')).toBe(false); // Missing leading space
    });
  });

  describe('edge cases', () => {
    it('handles whitespace', () => {
      expect(isValidHttpDate(' Sun, 06 Nov 1994 08:49:37 GMT ')).toBe(true);
      expect(isValidHttpDate('  Mon Jan  1 00:00:00 2024  ')).toBe(true);
    });

    it('rejects invalid input types', () => {
      expect(isValidHttpDate('')).toBe(false);
      expect(isValidHttpDate('   ')).toBe(false);
    });

    it('rejects unparseable dates despite correct format', () => {
      expect(isValidHttpDate('Sun, 32 Nov 1994 08:49:37 GMT')).toBe(false); // Invalid day
      expect(isValidHttpDate('Sun, 06 Xyz 1994 08:49:37 GMT')).toBe(false); // Invalid month
    });

    it('rejects non-HTTP date formats', () => {
      expect(isValidHttpDate('2024-01-01T00:00:00Z')).toBe(false); // ISO 8601
      expect(isValidHttpDate('01/01/2024')).toBe(false); // US format
    });
  });
});

describe('compareETags', () => {
  describe('weak comparison', () => {
    it('matches ETags with same opaque tag regardless of weak prefix', () => {
      expect(compareETags('W/"123"', 'W/"123"', true)).toBe(true);
      expect(compareETags('W/"123"', '"123"', true)).toBe(true);
      expect(compareETags('"123"', 'W/"123"', true)).toBe(true);
      expect(compareETags('"123"', '"123"', true)).toBe(true);
    });

    it('does not match ETags with different opaque tags', () => {
      expect(compareETags('W/"123"', 'W/"456"', true)).toBe(false);
      expect(compareETags('"123"', '"456"', true)).toBe(false);
    });

    it('handles case sensitivity in opaque tags', () => {
      expect(compareETags('"abc"', '"ABC"', true)).toBe(false);
    });

    it('handles lowercase w/ prefix', () => {
      expect(compareETags('w/"123"', 'W/"123"', true)).toBe(true);
      expect(compareETags('w/"123"', '"123"', true)).toBe(true);
    });
  });

  describe('strong comparison', () => {
    it('matches two strong ETags with same opaque tag', () => {
      expect(compareETags('"123"', '"123"', false)).toBe(true);
      expect(compareETags('"abc"', '"abc"', false)).toBe(true);
    });

    it('does not match if either ETag is weak', () => {
      expect(compareETags('W/"123"', '"123"', false)).toBe(false);
      expect(compareETags('"123"', 'W/"123"', false)).toBe(false);
      expect(compareETags('W/"123"', 'W/"123"', false)).toBe(false);
    });

    it('does not match strong ETags with different opaque tags', () => {
      expect(compareETags('"123"', '"456"', false)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles whitespace in ETags', () => {
      expect(compareETags(' "123" ', '"123"', true)).toBe(true);
      expect(compareETags(' W/"123" ', 'W/"123"', false)).toBe(false);
    });

    it('returns false for empty strings', () => {
      expect(compareETags('', '"123"', true)).toBe(false);
      expect(compareETags('"123"', '', true)).toBe(false);
      expect(compareETags('', '', true)).toBe(false);
    });
  });
});

describe('parseConditionalETagHeader', () => {
  it('parses wildcard correctly', () => {
    expect(parseConditionalETagHeader('*')).toEqual(['*']);
  });

  it('parses wildcard with whitespace', () => {
    expect(parseConditionalETagHeader(' * ')).toEqual(['*']);
  });

  it('parses single ETag', () => {
    expect(parseConditionalETagHeader('"123"')).toEqual(['"123"']);
    expect(parseConditionalETagHeader('W/"123"')).toEqual(['W/"123"']);
  });

  it('parses multiple ETags', () => {
    expect(parseConditionalETagHeader('"123", "456", W/"789"')).toEqual([
      '"123"',
      '"456"',
      'W/"789"',
    ]);
  });

  it('handles whitespace around ETags', () => {
    expect(parseConditionalETagHeader(' "123" , "456" , W/"789" ')).toEqual([
      '"123"',
      '"456"',
      'W/"789"',
    ]);
  });

  it('filters out empty entries', () => {
    expect(parseConditionalETagHeader('"123",,"456"')).toEqual([
      '"123"',
      '"456"',
    ]);
  });

  it('handles empty string', () => {
    expect(parseConditionalETagHeader('')).toEqual([]);
  });

  it('handles trailing comma', () => {
    expect(parseConditionalETagHeader('"123","456",')).toEqual([
      '"123"',
      '"456"',
    ]);
  });
});

describe('hasInvalidConditionalETagSyntax', () => {
  it('returns false for valid wildcard alone', () => {
    expect(hasInvalidConditionalETagSyntax('*')).toBe(false);
  });

  it('returns false for valid multiple ETags without wildcard', () => {
    expect(hasInvalidConditionalETagSyntax('"123", "456"')).toBe(false);
    expect(hasInvalidConditionalETagSyntax('W/"123", "456", W/"789"')).toBe(
      false,
    );
  });

  it('returns false for single ETag', () => {
    expect(hasInvalidConditionalETagSyntax('"123"')).toBe(false);
  });

  it('returns true for wildcard mixed with other values', () => {
    expect(hasInvalidConditionalETagSyntax('*, "123"')).toBe(true);
    expect(hasInvalidConditionalETagSyntax('"123", *')).toBe(true);
    expect(hasInvalidConditionalETagSyntax('"123", *, "456"')).toBe(true);
  });

  it('returns false for empty or invalid input', () => {
    expect(hasInvalidConditionalETagSyntax('')).toBe(false);
  });
});

describe('compareHttpDates', () => {
  it('returns -1 when first date is earlier', () => {
    expect(
      compareHttpDates(
        'Sun, 06 Nov 1994 08:49:37 GMT',
        'Mon, 07 Nov 1994 08:49:37 GMT',
      ),
    ).toBe(-1);
  });

  it('returns 1 when first date is later', () => {
    expect(
      compareHttpDates(
        'Mon, 07 Nov 1994 08:49:37 GMT',
        'Sun, 06 Nov 1994 08:49:37 GMT',
      ),
    ).toBe(1);
  });

  it('returns 0 when dates are equal', () => {
    expect(
      compareHttpDates(
        'Sun, 06 Nov 1994 08:49:37 GMT',
        'Sun, 06 Nov 1994 08:49:37 GMT',
      ),
    ).toBe(0);
  });

  it('compares dates across different formats', () => {
    // Note: asctime format doesn't include timezone and may be parsed differently
    const result = compareHttpDates(
      'Sun, 06 Nov 1994 08:49:37 GMT',
      'Sunday, 06-Nov-94 08:49:37 GMT',
    );
    expect(result).toBe(0);
  });

  it('returns null for invalid first date', () => {
    expect(compareHttpDates('invalid', 'Sun, 06 Nov 1994 08:49:37 GMT')).toBe(
      null,
    );
  });

  it('returns null for invalid second date', () => {
    expect(compareHttpDates('Sun, 06 Nov 1994 08:49:37 GMT', 'invalid')).toBe(
      null,
    );
  });

  it('returns null for both invalid dates', () => {
    expect(compareHttpDates('invalid1', 'invalid2')).toBe(null);
  });

  it('handles dates with different time components', () => {
    expect(
      compareHttpDates(
        'Sun, 06 Nov 1994 08:49:37 GMT',
        'Sun, 06 Nov 1994 08:49:38 GMT',
      ),
    ).toBe(-1);
  });
});
