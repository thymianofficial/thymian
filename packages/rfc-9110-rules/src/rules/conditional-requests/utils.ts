/**
 * Utility functions for RFC9110 Conditional Requests validation
 */

/**
 * Checks if an ETag is marked as weak (starts with W/)
 * @param etag The ETag value to check
 * @returns true if the ETag is weak, false otherwise
 */
export function isWeakETag(etag: string): boolean {
  return etag.trim().startsWith('W/') || etag.trim().startsWith('w/');
}

/**
 * Checks if an ETag is strong (not marked as weak)
 * @param etag The ETag value to check
 * @returns true if the ETag is strong, false otherwise
 */
export function isStrongETag(etag: string): boolean {
  return !isWeakETag(etag);
}

/**
 * Validates if a string is a valid HTTP-date according to RFC9110
 * Accepts IMF-fixdate, obsolete RFC 850, and ANSI C's asctime() format
 * @param date The date string to validate
 * @returns true if valid HTTP-date, false otherwise
 */
export function isValidHttpDate(date: string): boolean {
  if (!date || typeof date !== 'string') {
    return false;
  }

  const trimmed = date.trim();

  // IMF-fixdate format: Sun, 06 Nov 1994 08:49:37 GMT
  const imfFixdate =
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

  // RFC 850 format: Sunday, 06-Nov-94 08:49:37 GMT
  const rfc850 =
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \d{2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2} \d{2}:\d{2}:\d{2} GMT$/;

  // asctime format: Sun Nov  6 08:49:37 1994
  const asctime =
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ( \d|\d{2}) \d{2}:\d{2}:\d{2} \d{4}$/;

  if (
    imfFixdate.test(trimmed) ||
    rfc850.test(trimmed) ||
    asctime.test(trimmed)
  ) {
    // Additional validation: ensure it's parseable as a valid date
    const parsed = new Date(trimmed);
    return !isNaN(parsed.getTime());
  }

  return false;
}

/**
 * Compares two ETags according to RFC9110 rules
 * @param etag1 First ETag to compare
 * @param etag2 Second ETag to compare
 * @param useWeakComparison If true, uses weak comparison; otherwise uses strong comparison
 * @returns true if ETags match according to the comparison type
 */
export function compareETags(
  etag1: string,
  etag2: string,
  useWeakComparison: boolean,
): boolean {
  if (!etag1 || !etag2) {
    return false;
  }

  const clean1 = etag1.trim();
  const clean2 = etag2.trim();

  // Extract opaque tags (remove W/ prefix if present)
  const opaque1 = clean1.replace(/^[Ww]\//, '');
  const opaque2 = clean2.replace(/^[Ww]\//, '');

  if (useWeakComparison) {
    // Weak comparison: compare opaque tags only
    return opaque1 === opaque2;
  } else {
    // Strong comparison: both must be strong ETags and opaque tags must match
    return isStrongETag(clean1) && isStrongETag(clean2) && opaque1 === opaque2;
  }
}

/**
 * Parses If-Match or If-None-Match header value into individual ETags
 * Handles both "*" and comma-separated ETag lists
 * @param headerValue The If-Match or If-None-Match header value
 * @returns Array of ETag strings, or ["*"] if the value is "*"
 */
export function parseConditionalETagHeader(headerValue: string): string[] {
  if (!headerValue || typeof headerValue !== 'string') {
    return [];
  }

  const trimmed = headerValue.trim();

  // Handle wildcard
  if (trimmed === '*') {
    return ['*'];
  }

  // Split by comma and clean up each ETag
  const etags = trimmed
    .split(',')
    .map((etag) => etag.trim())
    .filter((etag) => etag.length > 0);

  return etags;
}

/**
 * Validates If-Match or If-None-Match header syntax
 * According to RFC9110, the header must not contain "*" mixed with other values
 * @param headerValue The If-Match or If-None-Match header value
 * @returns true if syntax is invalid (violation), false if valid
 */
export function hasInvalidConditionalETagSyntax(headerValue: string): boolean {
  if (!headerValue || typeof headerValue !== 'string') {
    return false;
  }

  const etags = parseConditionalETagHeader(headerValue);

  // If there's a "*" and other values, it's invalid
  if (etags.includes('*') && etags.length > 1) {
    return true;
  }

  return false;
}

/**
 * Compares two HTTP dates
 * @param date1 First date string
 * @param date2 Second date string
 * @returns -1 if date1 < date2, 0 if equal, 1 if date1 > date2, null if invalid
 */
export function compareHttpDates(
  date1: string,
  date2: string,
): -1 | 0 | 1 | null {
  if (!isValidHttpDate(date1) || !isValidHttpDate(date2)) {
    return null;
  }

  const time1 = new Date(date1).getTime();
  const time2 = new Date(date2).getTime();

  if (time1 < time2) {
    return -1;
  }
  if (time1 > time2) {
    return 1;
  }
  return 0;
}
