/**
 * Utility functions for RFC9110 Identifiers validation
 */

/**
 * Checks whether an absolute-form 'http' or 'https' request target has an
 * empty host in its authority component.
 *
 * WHATWG URL cannot represent an empty host for these schemes — parsing
 * either throws or folds the following path segment into the host — so the
 * raw target string has to be inspected before any URL parsing.
 *
 * @param target The raw request target URI
 * @returns true if the target is absolute-form http(s) with an empty host
 */
export function targetUriHasEmptyHost(target: string): boolean {
  const authorityMatch = /^https?:\/\/([^/?#]*)/i.exec(target);
  if (!authorityMatch) {
    return false;
  }

  const authority = authorityMatch[1] ?? '';
  const host = authority
    .slice(authority.lastIndexOf('@') + 1)
    .replace(/:\d*$/, '');

  return host === '';
}
