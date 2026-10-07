import { describe, expect, it } from 'vitest';

import {
  isSameTsPath,
  toTypeScriptPath,
  tsPathRelativeTo,
} from '../src/ts-path.js';

describe('toTypeScriptPath', () => {
  it('leaves a forward-slashed path untouched', () => {
    expect(toTypeScriptPath('/tmp/thymian-probe-abc/probe.ts')).toBe(
      '/tmp/thymian-probe-abc/probe.ts',
    );
  });

  it('turns a Windows-separated path into the TypeScript form', () => {
    expect(
      toTypeScriptPath('C:\\Users\\dev\\thymian-probe-abc\\probe.ts'),
    ).toBe('C:/Users/dev/thymian-probe-abc/probe.ts');
  });

  it('normalizes a mix of both separators the same way', () => {
    expect(toTypeScriptPath('C:\\Users\\dev/thymian\\probe.ts')).toBe(
      'C:/Users/dev/thymian/probe.ts',
    );
  });
});

describe('isSameTsPath', () => {
  it('matches a Windows-native path against its TypeScript-reported form', () => {
    expect(
      isSameTsPath(
        'C:\\Users\\dev\\AppData\\Local\\Temp\\thymian-probe-1\\probe.ts',
        'C:/Users/dev/AppData/Local/Temp/thymian-probe-1/probe.ts',
      ),
    ).toBe(true);
  });

  it('rejects two genuinely different paths', () => {
    expect(isSameTsPath('/root/probe.ts', '/root/other.ts')).toBe(false);
  });
});

describe('tsPathRelativeTo', () => {
  it('returns the relative path when fileName is under root, on POSIX', () => {
    expect(
      tsPathRelativeTo(
        '/tmp/thymian-surface-1/generated/hooks-api.d.ts',
        '/tmp/thymian-surface-1/generated',
      ),
    ).toBe('hooks-api.d.ts');
  });

  it('returns the relative path when fileName is under a Windows-native root', () => {
    // What `node:path.join` would hand back for a scratch root on Windows,
    // against what `ts.createProgram` would report for a file inside it.
    const nativeScratch = 'C:\\Users\\dev\\Temp\\thymian-validate-1';
    const tsFileName =
      'C:/Users/dev/Temp/thymian-validate-1/generated/hooks-api.d.ts';

    expect(tsPathRelativeTo(tsFileName, nativeScratch)).toBe(
      'generated/hooks-api.d.ts',
    );
  });

  it('returns undefined when fileName is not under root', () => {
    expect(
      tsPathRelativeTo(
        '/tmp/thymian-probe-1/probe.ts',
        '/tmp/thymian-probe-1/generated',
      ),
    ).toBeUndefined();
  });

  it('does not treat a sibling with an overlapping prefix as "under" root', () => {
    expect(
      tsPathRelativeTo(
        '/tmp/thymian-probe-12/probe.ts',
        '/tmp/thymian-probe-1',
      ),
    ).toBeUndefined();
  });
});
