import { describe, expect, it } from 'vitest';

import { shortenHomeDir } from '../src/draft.js';

describe('shortenHomeDir', () => {
  describe('on POSIX', () => {
    const options = { home: '/home/alice', platform: 'linux' } as const;

    it('shortens the home directory in a file URL frame', () => {
      expect(
        shortenHomeDir(
          'Error: x\n    at file:///home/alice/project/src/a.js:1:2',
          options,
        ),
      ).toBe('Error: x\n    at ~/project/src/a.js:1:2');
    });

    it('shortens only the home directory, not a longer one it prefixes', () => {
      expect(
        shortenHomeDir(
          'Error: x\n    at /home/alice/a.js:1\n    at /home/alicex/b.js:2',
          options,
        ),
      ).toBe('Error: x\n    at ~/a.js:1\n    at /home/alicex/b.js:2');
    });

    it('leaves the stack untouched when the home directory is the root', () => {
      const stack = 'Error: x\n    at /project/a.js:1:2';

      expect(shortenHomeDir(stack, { ...options, home: '/' })).toBe(stack);
    });

    it('leaves the stack untouched when there is no home directory', () => {
      const stack = 'Error: x\n    at /home/alice/a.js:1:2';

      expect(shortenHomeDir(stack, { ...options, home: '' })).toBe(stack);
    });
  });

  describe('on Windows', () => {
    const options = { home: 'C:\\Users\\alice', platform: 'win32' } as const;

    it('shortens the native home directory', () => {
      expect(
        shortenHomeDir(
          'Error: x\n    at C:\\Users\\alice\\project\\src\\a.js:1:2',
          options,
        ),
      ).toBe('Error: x\n    at ~\\project\\src\\a.js:1:2');
    });

    it('shortens the home directory in a file URL frame, percent-encoded', () => {
      expect(
        shortenHomeDir(
          'Error: x\n    at file:///C:/Users/alice%20smith/project/a.js:1:2',
          { ...options, home: 'C:\\Users\\alice smith' },
        ),
      ).toBe('Error: x\n    at ~/project/a.js:1:2');
    });

    it('shortens the home directory written with forward slashes', () => {
      expect(
        shortenHomeDir(
          'Error: x\n    at C:/Users/alice/project/a.js:1:2',
          options,
        ),
      ).toBe('Error: x\n    at ~/project/a.js:1:2');
    });

    it('leaves the stack untouched when the home directory is the root', () => {
      const stack = 'Error: x\n    at C:\\project\\a.js:1:2';

      expect(shortenHomeDir(stack, { ...options, home: 'C:\\' })).toBe(stack);
    });
  });
});
