import { createHttpResponse } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { header } from '../../test/builders.js';
import {
  carriesHeader,
  declaresHeader,
  liveHeaderValues,
  pinnedHeaderValues,
} from './headers.js';

// Header names compare case-insensitively, whichever side spells one with
// capitals: the response that carries the header, or the rule asking for it.
const spellings = ['strict-transport-security', 'Strict-Transport-Security'];
const VALUE = 'max-age=31536000';

describe.each(
  spellings.flatMap((carried) => spellings.map((asked) => [carried, asked])),
)('a header carried as %s and asked for as %s', (carried, asked) => {
  it('is carried, by name, through the common interface', () => {
    const res = {
      statusCode: 200,
      mediaType: '',
      headers: [carried],
      body: false,
      trailers: [],
    };

    expect(carriesHeader(res, asked)).toBe(true);
  });

  it('is declared, with the value the description pins', () => {
    const res = createHttpResponse({ headers: header(carried, VALUE) });

    expect(declaresHeader(res, asked)).toBe(true);
    expect(pinnedHeaderValues(res, asked)).toEqual([VALUE]);
  });

  it('is sent', () => {
    expect(liveHeaderValues({ [carried]: VALUE }, asked)).toEqual([VALUE]);
  });
});
