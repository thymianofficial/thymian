import {
  apiDescription,
  recorded,
  respondWith,
  SECURE,
  setCookieHeader,
  setCookieLines,
} from '../../test/builders.js';
import type { RuleFixtures } from '../../test/harness.js';
import rule from './server-should-avoid-large-cookies.rule.js';

// A cookie of 3000 octets of name and value: one is well under a browser's
// 4096 per cookie, three of them make a Cookie header of 9007 octets, past
// the 8192 of many servers, and two make one of 6004.
const large = (name: string) => `${name}=${'x'.repeat(3000 - name.length)}`;

// One response, one Set-Cookie: `static` sees the cookie-string grow over the
// responses of the description, as a browser's store does. Three responses
// that each set the same large cookie hold one cookie, not three.
const describing = (...lines: string[]) =>
  apiDescription(
    ...lines.map((line, index) => ({
      request: { path: `/${index}` },
      response: { headers: setCookieHeader(line) },
    })),
  );

// Fifty cookies is what draft-22 asks a browser to keep for one domain at
// least; the fifty-first is one it may evict.
const small = (count: number) =>
  Array.from({ length: count }, (_, index) => `c${index}=1`);

const OTHER_HOST = { ...SECURE, host: 'www.example.com' } as const;

export default {
  rule,
  static: {
    violates: { format: describing(large('A'), large('B'), large('C')) },
    conforms: {
      format: describing(large('SID'), large('SID'), large('SID')),
    },
    skips: {
      format: apiDescription({ response: { headers: setCookieHeader() } }),
    },
  },
  test: {
    violates: {
      format: apiDescription({}),
      respond: respondWith({ headers: setCookieLines(small(51)) }),
    },
    conforms: {
      format: apiDescription({}),
      respond: respondWith({ headers: setCookieLines(small(50)) }),
    },
  },
  // The cookies of two responses add up for the host that set them both; the
  // same two responses from two hosts are two cookie-strings.
  analytics: {
    violates: {
      transactions: [
        recorded({ headers: setCookieLines([large('A'), large('B')]) }),
        recorded({ path: '/c', headers: setCookieLines([large('C')]) }),
      ],
    },
    conforms: {
      transactions: [
        recorded({ headers: setCookieLines([large('A'), large('B')]) }),
        recorded({
          origin: OTHER_HOST,
          path: '/c',
          headers: setCookieLines([large('C')]),
        }),
      ],
    },
  },
} satisfies RuleFixtures;
