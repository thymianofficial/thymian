export interface AuthParameter {
  name: string;
  value: string;
  isQuoted: boolean;
}

export interface Challenge {
  scheme: string;
  token68?: string;
  parameters: AuthParameter[];
}

/**
 * Parses WWW-Authenticate or Proxy-Authenticate header values into Challenges.
 * Follows RFC 9110 Section 11 format.
 */
export function parseChallenges(headerValue: string): Challenge[] {
  const challenges: Challenge[] = [];
  const parts = splitByCommaIgnoringQuotes(headerValue);

  let currentChallenge: Challenge | null = null;

  for (let part of parts) {
    part = part.trim();
    if (!part) {
      continue;
    }

    // Check if this part starts with a new scheme or is a continuation of parameters
    // A new scheme is a token followed by a space or end of string, NOT followed by '='
    const firstSpaceIndex = part.indexOf(' ');
    const firstEqualsIndex = part.indexOf('=');

    const isNewScheme =
      firstEqualsIndex === -1 ||
      (firstSpaceIndex !== -1 && firstSpaceIndex < firstEqualsIndex);

    if (isNewScheme) {
      const scheme =
        firstSpaceIndex === -1 ? part : part.substring(0, firstSpaceIndex);
      const remainder =
        firstSpaceIndex === -1 ? '' : part.substring(firstSpaceIndex).trim();

      currentChallenge = {
        scheme,
        parameters: [],
      };
      challenges.push(currentChallenge);

      if (remainder) {
        if (remainder.indexOf('=') === -1) {
          // Likely token68
          currentChallenge.token68 = remainder;
        } else {
          // It's a list of parameters starting right after the scheme
          parseParameters(remainder, currentChallenge.parameters);
        }
      }
    } else if (currentChallenge) {
      // Continuation of parameters for the current challenge
      parseParameters(part, currentChallenge.parameters);
    }
  }

  return challenges;
}

function parseParameters(input: string, target: AuthParameter[]) {
  const params = splitByCommaIgnoringQuotes(input);
  for (const param of params) {
    const eqIndex = param.indexOf('=');
    if (eqIndex !== -1) {
      const name = param.substring(0, eqIndex).trim();
      let value = param.substring(eqIndex + 1).trim();
      let isQuoted = false;

      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
        isQuoted = true;
      }

      target.push({ name, value, isQuoted });
    }
  }
}

function splitByCommaIgnoringQuotes(input: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
