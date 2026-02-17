import { type CachedError } from '@thymian/cli-common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createEmailReport } from '../src/create-email-issue-for-error.js';

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
    const error: CachedError = {
      name: 'TestError',
      message: 'Test error message',
      commandName: 'test:command',
      timestamp: Date.now(),
      argv: ['node', 'thymian', 'test'],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
        osVersion: 'Linux',
      },
      pluginVersions: [],
    };

    const url = createEmailReport(testRecipient, error);

    expect(url).toMatch(/^mailto:support@example\.com\?subject=.*&body=.*/);
  });

  it('should URL-encode subject', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test:command',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createEmailReport(testRecipient, error);

    expect(url).toContain('subject=CLI%20Error%20Report%3A%20test%3Acommand');
  });

  it('should URL-encode body', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('Hi Support Team,');
  });

  it('should include error details when errorData provided', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test error',
      commandName: 'test:command',
      timestamp: 1234567890000,
      argv: ['node', 'thymian'],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
        osVersion: 'Linux',
      },
      pluginVersions: [],
    };

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('--- ERROR REPORT ---');
    expect(decodedUrl).toContain('Command: test:command');
  });

  it('should include environment information', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'arm64',
        cliVersion: '2.0.0',
        nodeVersion: 'v20.0.0',
        osVersion: 'Darwin 23.0.0',
      },
      pluginVersions: [],
    };

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('ENVIRONMENT:');
    expect(decodedUrl).toContain('- CLI: 2.0.0');
    expect(decodedUrl).toContain('- Node: v20.0.0');
    expect(decodedUrl).toContain('- OS: Darwin 23.0.0 (arm64)');
  });

  it('should include plugin versions', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [
        { name: '@thymian/openapi', version: '1.0.0' },
        { name: '@thymian/http-linter', version: '2.0.0' },
      ],
    };

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('PLUGINS:');
    expect(decodedUrl).toContain('- @thymian/openapi: 1.0.0');
    expect(decodedUrl).toContain('- @thymian/http-linter: 2.0.0');
  });

  it('should include stack trace with HOME replaced by ~', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      stack: `Error: Test\n  at /home/testuser/project/src/test.ts:10\n  at /home/testuser/.config/test.js:20`,
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('STACKTRACE:');
    expect(decodedUrl).toContain('~/project/src/test.ts:10');
    expect(decodedUrl).toContain('~/.config/test.js:20');
    expect(decodedUrl).not.toContain('/home/testuser');
  });

  it('should handle missing stack trace', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('STACKTRACE:');
    expect(decodedUrl).toContain('No stacktrace available');
  });

  it('should format timestamp correctly', () => {
    const timestamp = 1234567890000;
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp,
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    const expectedTimestamp = new Date(timestamp).toLocaleString();
    expect(decodedUrl).toContain(`Timestamp: ${expectedTimestamp}`);
  });

  it('should include feedback message header', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('Hi Support Team,');
    expect(decodedUrl).toContain(
      "I'd like to provide some feedback regarding the CLI.",
    );
  });

  it('should include footer with signature placeholder', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('Best regards,');
    expect(decodedUrl).toContain('[Your Name]');
  });

  it('should handle empty plugin list', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    expect(decodedUrl).toContain('PLUGINS:');
    // Empty array should result in empty plugins section
    expect(decodedUrl).toMatch(/PLUGINS:\s+STACKTRACE:/);
  });

  it('should use correct subject format', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'custom:command',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createEmailReport(testRecipient, error);

    expect(url).toContain('subject=CLI%20Error%20Report%3A%20custom%3Acommand');
  });

  it('should include recipient in mailto URL', () => {
    const customRecipient = 'custom@support.com';
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createEmailReport(customRecipient, error);

    expect(url).toContain('mailto:custom@support.com?');
  });

  it('should trim body content', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createEmailReport(testRecipient, error);
    const decodedUrl = decodeURIComponent(url);

    // Body should start with Hi Support Team (no leading whitespace)
    expect(decodedUrl).toContain('body=Hi Support Team,');
  });
});
