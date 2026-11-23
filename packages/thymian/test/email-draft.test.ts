import os from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createEmailDraft } from '../src/email-draft.js';
import { aCachedError } from './support/cached-error.js';

describe('createEmailDraft', () => {
  const testRecipient = 'support@example.com';

  beforeEach(() => {
    vi.spyOn(os, 'homedir').mockReturnValue('/home/testuser');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate proper mailto URL', () => {
    const error = aCachedError({
      message: 'Test error message',
      commandName: 'test:command',
      argv: ['node', 'thymian', 'test'],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
        osVersion: 'Linux',
      },
    });

    const url = createEmailDraft(testRecipient, error).url;

    expect(url).toMatch(/^mailto:support@example\.com\?subject=.*&body=.*/);
  });

  it('should URL-encode subject', () => {
    const error = aCachedError({
      commandName: 'test:command',
    });

    const url = createEmailDraft(testRecipient, error).url;

    expect(url).toContain('subject=CLI%20error%20in%20test%3Acommand');
  });

  it('should URL-encode body', () => {
    const error = aCachedError();

    const url = createEmailDraft(testRecipient, error).url;
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('Hi Support Team,');
  });

  it('should include error details when errorData provided', () => {
    const error = aCachedError({
      message: 'Test error',
      commandName: 'test:command',
      argv: ['node', 'thymian'],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
        osVersion: 'Linux',
      },
    });

    const url = createEmailDraft(testRecipient, error).url;
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('Command: test:command');
  });

  it('should include environment information', () => {
    const error = aCachedError({
      version: {
        architecture: 'arm64',
        cliVersion: '2.0.0',
        nodeVersion: 'v20.0.0',
        osVersion: 'Darwin 23.0.0',
      },
    });

    const url = createEmailDraft(testRecipient, error).url;
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('ENVIRONMENT:');
    expect(decodedUrl).toContain('- CLI: 2.0.0');
    expect(decodedUrl).toContain('- Node: v20.0.0');
    expect(decodedUrl).toContain('- OS: Darwin 23.0.0 (arm64)');
  });

  it('should include plugin versions', () => {
    const error = aCachedError({
      pluginVersions: [
        { name: '@thymian/plugin-openapi', version: '1.0.0' },
        { name: '@thymian/plugin-http-linter', version: '2.0.0' },
      ],
    });

    const url = createEmailDraft(testRecipient, error).url;
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('PLUGINS:');
    expect(decodedUrl).toContain('- @thymian/plugin-openapi: 1.0.0');
    expect(decodedUrl).toContain('- @thymian/plugin-http-linter: 2.0.0');
  });

  it('should include stack trace with HOME replaced by ~', () => {
    const error = aCachedError({
      stack: `Error: Test\n  at /home/testuser/project/src/test.ts:10\n  at /home/testuser/.config/test.js:20`,
    });

    const url = createEmailDraft(testRecipient, error).url;
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('STACKTRACE:');
    expect(decodedUrl).toContain('~/project/src/test.ts:10');
    expect(decodedUrl).toContain('~/.config/test.js:20');
    expect(decodedUrl).not.toContain('/home/testuser');
  });

  it('should handle missing stack trace', () => {
    const error = aCachedError();

    const url = createEmailDraft(testRecipient, error).url;
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('STACKTRACE:');
    expect(decodedUrl).toContain('No stacktrace available');
  });

  it('should format timestamp correctly', () => {
    const timestamp = 1234567890000;
    const error = aCachedError({
      timestamp,
    });

    const url = createEmailDraft(testRecipient, error).url;
    const decodedUrl = decodeURIComponent(url);

    const expectedTimestamp = new Date(timestamp).toLocaleString();
    expect(decodedUrl).toContain(`Timestamp: ${expectedTimestamp}`);
  });

  it('should include feedback message header', () => {
    const error = aCachedError();

    const url = createEmailDraft(testRecipient, error).url;
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('Hi Support Team,');
    expect(decodedUrl).toContain(
      "I'd like to provide some feedback regarding the CLI.",
    );
  });

  it('should include footer with signature placeholder', () => {
    const error = aCachedError();

    const url = createEmailDraft(testRecipient, error).url;
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('Best regards,');
    expect(decodedUrl).toContain('[Your Name]');
  });

  it('should handle empty plugin list', () => {
    const error = aCachedError();

    const url = createEmailDraft(testRecipient, error).url;
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('PLUGINS:');
    // Empty array should result in empty plugins section
    expect(decodedUrl).toMatch(/PLUGINS:\s+STACKTRACE:/);
  });

  it('should use correct subject format', () => {
    const error = aCachedError({
      commandName: 'custom:command',
    });

    const url = createEmailDraft(testRecipient, error).url;

    expect(url).toContain('subject=CLI%20error%20in%20custom%3Acommand');
  });

  it('should include recipient in mailto URL', () => {
    const customRecipient = 'custom@support.com';
    const error = aCachedError();

    const url = createEmailDraft(customRecipient, error).url;

    expect(url).toContain('mailto:custom@support.com?');
  });

  it('should trim body content', () => {
    const error = aCachedError();

    const url = createEmailDraft(testRecipient, error).url;
    const decodedUrl = decodeURIComponent(url);

    // Body should start with Hi Support Team (no leading whitespace)
    expect(decodedUrl).toContain('body=Hi Support Team,');
  });
  describe('the draft', () => {
    const error = aCachedError({
      stack: 'Error: Test\n  at /home/testuser/project/src/test.ts:10',
      commandName: 'lint',
    });

    function openedParams(url: string): URLSearchParams {
      return new URLSearchParams(url.slice(url.indexOf('?') + 1));
    }

    it('carries exactly the subject and body that the mailto opens', () => {
      const draft = createEmailDraft(testRecipient, error);
      const params = openedParams(draft.url);

      expect(draft.heading).toBe('CLI error in lint');
      expect(params.get('subject')).toBe(draft.heading);
      expect(params.get('body')).toBe(draft.body);
    });

    it('calls itself an email draft and has no ERROR REPORT banner', () => {
      const draft = createEmailDraft(testRecipient, error);

      expect(draft.body).toContain('email draft');
      expect(draft.body).not.toContain('ERROR REPORT');
      expect(draft.heading).not.toMatch(/report/i);
    });

    it('leaves the stack out, with a placeholder line in its place', () => {
      const draft = createEmailDraft(testRecipient, error, {
        withoutStack: true,
      });

      expect(openedParams(draft.url).get('body')).toBe(draft.body);
      expect(draft.body.split('\n')).toContain('[Stack trace left out]');
      expect(draft.body).not.toContain('project/src/test.ts');
      expect(draft.body).toContain('Command: lint');
    });
  });
});
