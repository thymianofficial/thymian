/**
 * Parse authentication challenge from WWW-Authenticate or Proxy-Authenticate header
 * Returns array of challenges, each with scheme and parameters
 *
 * RFC 9110 Section 11.2:
 * challenge = auth-scheme [ 1*SP ( token68 / #auth-param ) ]
 * auth-param = token BWS "=" BWS ( token / quoted-string )
 */
export function parseAuthenticationHeader(headerValue: string): Array<{
  scheme: string;
  parameters: Record<string, string>;
}> {
  const challenges: Array<{
    scheme: string;
    parameters: Record<string, string>;
  }> = [];

  // Split on commas, but be careful of commas within quoted strings
  const tokens = tokenizeHeader(headerValue);

  let i = 0;
  while (i < tokens.length) {
    const schemeToken = tokens[i];
    if (!schemeToken || schemeToken.trim() === '') {
      i++;
      continue;
    }

    const scheme = schemeToken.trim();
    const parameters: Record<string, string> = {};
    i++;

    // Parse auth-params until we hit the next scheme (token without =)
    while (i < tokens.length) {
      const token = tokens[i];
      if (!token) {
        i++;
        continue;
      }
      const trimmedToken = token.trim();

      // Check if this looks like a new scheme (no = sign, not a value)
      const prevToken = tokens[i - 1];
      if (
        !trimmedToken.includes('=') &&
        i > 0 &&
        prevToken &&
        !prevToken.includes('=')
      ) {
        // This is likely a new scheme
        break;
      }

      // Parse auth-param: name=value
      const eqIndex = trimmedToken.indexOf('=');
      if (eqIndex > 0) {
        const name = trimmedToken.substring(0, eqIndex).trim().toLowerCase();
        let value = trimmedToken.substring(eqIndex + 1).trim();

        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }

        parameters[name] = value;
      }

      i++;
    }

    challenges.push({ scheme, parameters });
  }

  return challenges;
}

/**
 * Tokenize header value, respecting quoted strings
 */
function tokenizeHeader(headerValue: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let escaped = false;

  for (let i = 0; i < headerValue.length; i++) {
    const char = headerValue[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && inQuotes) {
      escaped = true;
      current += char;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (char === ',' && !inQuotes) {
      if (current.trim()) {
        tokens.push(current.trim());
      }
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
}

/**
 * Check if a challenge has duplicate parameter names (case-insensitive)
 *
 * RFC 9110 Section 11.2:
 * "each parameter name MUST only occur once per challenge"
 */
export function hasDuplicateParameters(challenge: {
  parameters: Record<string, string>;
}): boolean {
  const paramNames = Object.keys(challenge.parameters);
  const lowerNames = paramNames.map((name) => name.toLowerCase());
  const uniqueNames = new Set(lowerNames);

  return lowerNames.length !== uniqueNames.size;
}

/**
 * Check if a parameter value uses quoted-string syntax (enclosed in quotes)
 *
 * RFC 9110 Section 11.5:
 * "For historical reasons, a sender MUST only generate the quoted-string syntax"
 */
export function isQuotedString(value: string): boolean {
  return value.startsWith('"') && value.endsWith('"');
}

/**
 * Get the raw parameter value from a header (before unquoting)
 * This is needed to check if the original value was quoted
 */
export function getRawParameterValue(
  headerValue: string,
  paramName: string,
): string | undefined {
  // Look for paramName= in the header
  const paramNameLower = paramName.toLowerCase();
  const regex = new RegExp(
    `\\b${paramNameLower}\\s*=\\s*([^,\\s]+|"[^"]*")`,
    'i',
  );
  const match = headerValue.match(regex);

  return match && match[1] ? match[1].trim() : undefined;
}
