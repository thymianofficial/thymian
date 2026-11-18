import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createEmailReport } from '../src/create-email-issue-for-error.js';
import { aCachedError } from './support/cached-error.js';

describe('createEmailReport', () => {
  const originalHome = process.env.HOME;
  const testRecipient = 'support@example.com';

  beforeEach(() => {
    process.env.HOME = '/home/testuser';
  });

  afterEach(() => {
    process.env.HOME = originalHome;
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

    const url = createEmailReport(testRecipient, error);

    expect(url).toMatch(/^mailto:support@example\.com\?subject=.*&body=.*/);
  });

  it('should URL-encode subject', () => {
    const error = aCachedError({
      commandName: 'test:command',
    });

    const url = createEmailReport(testRecipient, error);

    expect(url).toContain('subject=CLI%20Error%20Report%3A%20test%3Acommand');
  });

  it('should URL-encode body', () => {
    const error = aCachedError();

    const url = createEmailReport(testRecipient, error);
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

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('--- ERROR REPORT ---');
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

    const url = createEmailReport(testRecipient, error);
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

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('PLUGINS:');
    expect(decodedUrl).toContain('- @thymian/plugin-openapi: 1.0.0');
    expect(decodedUrl).toContain('- @thymian/plugin-http-linter: 2.0.0');
  });

  it('should include stack trace with HOME replaced by ~', () => {
    const error = aCachedError({
      stack: `Error: Test\n  at /home/testuser/project/src/test.ts:10\n  at /home/testuser/.config/test.js:20`,
    });

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('STACKTRACE:');
    expect(decodedUrl).toContain('~/project/src/test.ts:10');
    expect(decodedUrl).toContain('~/.config/test.js:20');
    expect(decodedUrl).not.toContain('/home/testuser');
  });

  it('should handle missing stack trace', () => {
    const error = aCachedError();

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('STACKTRACE:');
    expect(decodedUrl).toContain('No stacktrace available');
  });

  it('should format timestamp correctly', () => {
    const timestamp = 1234567890000;
    const error = aCachedError({
      timestamp,
    });

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    const expectedTimestamp = new Date(timestamp).toLocaleString();
    expect(decodedUrl).toContain(`Timestamp: ${expectedTimestamp}`);
  });

  it('should include feedback message header', () => {
    const error = aCachedError();

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('Hi Support Team,');
    expect(decodedUrl).toContain(
      "I'd like to provide some feedback regarding the CLI.",
    );
  });

  it('should include footer with signature placeholder', () => {
    const error = aCachedError();

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('Best regards,');
    expect(decodedUrl).toContain('[Your Name]');
  });

  it('should handle empty plugin list', () => {
    const error = aCachedError();

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('PLUGINS:');
    // Empty array should result in empty plugins section
    expect(decodedUrl).toMatch(/PLUGINS:\s+STACKTRACE:/);
  });

  it('should use correct subject format', () => {
    const error = aCachedError({
      commandName: 'custom:command',
    });

    const url = createEmailReport(testRecipient, error);

    expect(url).toContain('subject=CLI%20Error%20Report%3A%20custom%3Acommand');
  });

  it('should include recipient in mailto URL', () => {
    const customRecipient = 'custom@support.com';
    const error = aCachedError();

    const url = createEmailReport(customRecipient, error);

    expect(url).toContain('mailto:custom@support.com?');
  });

  it('should trim body content', () => {
    const error = aCachedError();

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    // Body should start with Hi Support Team (no leading whitespace)
    expect(decodedUrl).toContain('body=Hi Support Team,');
  });
});
